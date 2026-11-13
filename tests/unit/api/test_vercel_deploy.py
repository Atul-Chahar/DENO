"""Vercel deploy plumbing (docs/15): cron auth, the Vercel Queues runner and subscriber, web search.
No network access."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import fakeredis
import httpx
import pytest
import respx

from deno_api.app import create_app
from deno_core import jobs, maintenance, runqueue
from deno_core.events import RunEvents
from deno_core.settings import Settings
from deno_sources.base import BraveSearchClient, ExaSearchClient, NoWebSearch, SearxngClient
from deno_sources.models import SourceUnavailable
from deno_sources.registry import SourceConfig, build_fetcher, build_web_search

SECRET = "s3cret-cron-token"


# ---- cron endpoints ----------------------------------------------------------


@pytest.fixture
def cron_client(monkeypatch: pytest.MonkeyPatch) -> httpx.AsyncClient:
    app = create_app(Settings(_env_file=None, environment="test", cron_secret=SECRET))  # type: ignore[call-arg]
    app.state.sessionmaker = object()

    async def purged(_maker: object) -> int:
        return 3

    async def requeued(_maker: object) -> int:
        return 1

    monkeypatch.setattr(maintenance, "purge_old_scraped_text", purged)
    monkeypatch.setattr(maintenance, "requeue_stale_runs", requeued)
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@pytest.mark.parametrize("method", ["GET", "POST"])
async def test_cron_runs_with_the_secret(cron_client: httpx.AsyncClient, method: str) -> None:
    headers = {"Authorization": f"Bearer {SECRET}"}
    async with cron_client as c:
        assert (await c.request(method, "/internal/cron/purge", headers=headers)).json() == {"purged": 3}
        assert (await c.request(method, "/internal/cron/requeue", headers=headers)).json() == {"requeued": 1}


@pytest.mark.parametrize(
    "header", [None, "Bearer nope", f"Basic {SECRET}", "Bearer "], ids=["missing", "wrong", "scheme", "empty"]
)
async def test_cron_rejects_anything_but_the_secret(cron_client: httpx.AsyncClient, header: str | None) -> None:
    async with cron_client as c:
        res = await c.get("/internal/cron/purge", headers={"Authorization": header} if header else {})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthenticated"


async def test_cron_is_hidden_when_not_configured() -> None:
    app = create_app(Settings(_env_file=None, environment="test"))  # type: ignore[call-arg]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        assert (await c.get("/internal/cron/purge", headers={"Authorization": f"Bearer {SECRET}"})).status_code == 404
    assert "/internal/cron/purge" not in json.dumps(app.openapi())


# ---- Vercel Queues runner ----------------------------------------------------------


async def test_enqueue_sends_one_idempotent_queue_message(monkeypatch: pytest.MonkeyPatch) -> None:
    import vercel.queue

    sent: list[tuple[str, Any, dict[str, Any]]] = []

    async def fake_send(topic: str, payload: Any, **kw: Any) -> str:
        sent.append((topic, payload, kw))
        return "msg_1"

    monkeypatch.setattr(vercel.queue, "send", fake_send)
    settings = Settings(_env_file=None, environment="test", task_runner="vercel_queue")  # type: ignore[call-arg]
    monkeypatch.setattr(jobs, "get_settings", lambda: settings)
    server = fakeredis.FakeServer()
    monkeypatch.setattr(runqueue.Redis, "from_url", staticmethod(lambda _url: fakeredis.FakeAsyncRedis(server=server)))

    assert await jobs.enqueue(jobs.TASK_VALIDATION_RUN, run_id="r1", user_id="u1") == "msg_1"
    # The run joined the fair line when it was started.
    assert await fakeredis.FakeAsyncRedis(server=server).zrange(runqueue.WAITING, 0, -1) == [b"r1"]
    topic, payload, kw = sent[0]
    assert topic == jobs.GRAPH_RUNS_TOPIC
    assert payload == {"task": "validation.run", "kwargs": {"run_id": "r1", "user_id": "u1"}}
    assert kw["idempotency_key"] == 'validation.run:{"run_id": "r1", "user_id": "u1"}'


class _Meta:
    delivery_count = 1


class _Msg:
    def __init__(self, payload: Any) -> None:
        self.payload = payload
        self.metadata = _Meta()


@pytest.fixture
def server() -> fakeredis.FakeServer:
    return fakeredis.FakeServer()


@pytest.fixture
def worker(monkeypatch: pytest.MonkeyPatch, server: fakeredis.FakeServer) -> Any:
    from deno_worker import queue

    settings = Settings(_env_file=None, environment="test", run_time_budget_s=30, run_queue_capacity=1)  # type: ignore[call-arg]
    monkeypatch.setattr(queue, "get_settings", lambda: settings)
    monkeypatch.setattr(queue, "_setup", lambda: None)
    monkeypatch.setattr(queue.Redis, "from_url", staticmethod(lambda _url: fakeredis.FakeAsyncRedis(server=server)))
    return queue


def _run(run_id: str) -> _Msg:
    return _Msg({"task": "validation.run", "kwargs": {"run_id": run_id, "user_id": "u"}})


async def test_subscriber_runs_the_graph(worker: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    ran: list[dict[str, str]] = []

    async def handler(_redis: object, **kw: str) -> None:
        ran.append(kw)

    monkeypatch.setitem(worker.GRAPH_HANDLERS, "validation.run", handler)
    await worker.run_graph(_Msg({"task": "validation.run", "kwargs": {"run_id": "r", "user_id": "u"}}))
    assert ran == [{"run_id": "r", "user_id": "u"}]


@pytest.mark.parametrize("payload", [{}, {"task": "nope", "kwargs": {}}, {"task": "validation.run"}, "junk"])
async def test_subscriber_acknowledges_messages_it_cannot_run(worker: Any, payload: Any) -> None:
    await worker.run_graph(_Msg(payload))  # returns normally: no redelivery would help


async def test_subscriber_hands_off_when_out_of_time(worker: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    from vercel.queue import RetryAfter

    async def slow(_redis: object, **_kw: str) -> None:
        await asyncio.sleep(60)

    monkeypatch.setitem(worker.GRAPH_HANDLERS, "validation.run", slow)
    monkeypatch.setattr(worker.get_settings(), "run_time_budget_s", 0.05)
    with pytest.raises(RetryAfter) as info:
        await worker.run_graph(_Msg({"task": "validation.run", "kwargs": {"run_id": "r", "user_id": "u"}}))
    assert _delay(info.value) == 0


async def test_subscriber_backs_off_on_transient_failures(worker: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    from vercel.queue import RetryAfter

    from deno_core.errors import UpstreamUnavailable

    async def flaky(_redis: object, **_kw: str) -> None:
        raise UpstreamUnavailable("NIM is down")

    monkeypatch.setitem(worker.GRAPH_HANDLERS, "validation.run", flaky)
    with pytest.raises(RetryAfter) as info:
        await worker.run_graph(_Msg({"task": "validation.run", "kwargs": {"run_id": "r", "user_id": "u"}}))
    assert _delay(info.value) == worker.TRANSIENT_BACKOFF_S


async def test_a_run_waits_its_turn_and_sees_its_place(
    worker: Any, server: fakeredis.FakeServer, monkeypatch: pytest.MonkeyPatch
) -> None:
    from vercel.queue import RetryAfter

    ran: list[str] = []

    async def handler(_redis: object, **kw: str) -> None:
        ran.append(kw["run_id"])

    monkeypatch.setitem(worker.GRAPH_HANDLERS, "validation.run", handler)
    r = fakeredis.FakeAsyncRedis(server=server)
    line = runqueue.run_queue(r, worker.get_settings())
    assert (await line.acquire("busy")).granted  # capacity 1: someone else is running
    with pytest.raises(RetryAfter) as info:
        await worker.run_graph(_run("mine"))
    assert ran == [] and 10 <= _delay(info.value) <= 60
    events = await RunEvents(r).read("mine", block_ms=0)
    assert events[-1].type == "queue" and events[-1].data["position"] == 1
    assert "You're next" in events[-1].data["message"]
    await line.release("busy")  # the other run finished
    await worker.run_graph(_run("mine"))
    assert ran == ["mine"]
    assert await r.zcard(runqueue.ACTIVE) == 0  # finished runs give the slot back


async def test_a_hand_off_keeps_the_slot(
    worker: Any, server: fakeredis.FakeServer, monkeypatch: pytest.MonkeyPatch
) -> None:
    from vercel.queue import RetryAfter

    async def slow(_redis: object, **_kw: str) -> None:
        await asyncio.sleep(60)

    monkeypatch.setitem(worker.GRAPH_HANDLERS, "validation.run", slow)
    monkeypatch.setattr(worker.get_settings(), "run_time_budget_s", 0.05)
    with pytest.raises(RetryAfter):
        await worker.run_graph(_run("long"))
    line = runqueue.run_queue(fakeredis.FakeAsyncRedis(server=server), worker.get_settings())
    assert not (await line.acquire("later")).granted  # "long" still holds the only slot
    assert (await line.acquire("long")).granted


async def test_too_many_hand_offs_stop_the_run(
    worker: Any, server: fakeredis.FakeServer, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def slow(_redis: object, **_kw: str) -> None:
        await asyncio.sleep(60)

    monkeypatch.setitem(worker.GRAPH_HANDLERS, "validation.run", slow)
    monkeypatch.setattr(worker.get_settings(), "run_time_budget_s", 0.05)
    r = fakeredis.FakeAsyncRedis(server=server)
    await r.set(worker.handoff_key("stuck"), worker.MAX_HANDOFFS)
    await worker.run_graph(_run("stuck"))  # acknowledged, not redelivered
    assert await r.zcard(runqueue.ACTIVE) == 0


async def test_a_run_cancelled_while_waiting_leaves_the_line(
    worker: Any, server: fakeredis.FakeServer, monkeypatch: pytest.MonkeyPatch
) -> None:
    r = fakeredis.FakeAsyncRedis(server=server)
    line = runqueue.run_queue(r, worker.get_settings())
    assert (await line.acquire("busy")).granted
    await line.join("gone")
    await RunEvents(r).request_cancel("gone")
    await worker.run_graph(_run("gone"))  # returns: nothing to run
    assert await r.zrange(runqueue.WAITING, 0, -1) == []


def test_wait_messages() -> None:
    from deno_worker import queue

    settings = Settings(_env_file=None, environment="test", run_queue_capacity=2, run_queue_avg_run_s=240)  # type: ignore[call-arg]
    assert "You're next" in queue.queue_message(runqueue.Place(False, 1), settings)
    msg = queue.queue_message(runqueue.Place(False, 5), settings)
    assert "4 validations ahead of you" in msg and "about 10 min" in msg and "close this tab" in msg
    assert queue.wait_seconds(runqueue.Place(False, 1)) == 15
    assert queue.wait_seconds(runqueue.Place(False, 40)) == 60


def _delay(directive: Any) -> float:
    for name in ("timeout_seconds", "delay", "seconds"):
        value = getattr(directive, name, None)
        if value is not None:
            return float(value.total_seconds() if hasattr(value, "total_seconds") else value)
    raise AssertionError(f"no delay on {directive!r}: {vars(directive)}")


# ---- web search -------------------------------------------------------------------


async def public(_: str) -> list[str]:
    return ["93.184.216.34"]


def _fetcher(config: SourceConfig) -> Any:
    return build_fetcher(config, resolver=public, transport=httpx.AsyncHTTPTransport())


def test_web_search_backend_follows_the_settings() -> None:
    def pick(**kw: Any) -> type:
        config = SourceConfig(**kw)
        return type(build_web_search(config, _fetcher(config)))

    assert pick(web_search_provider="brave", web_search_api_key="k") is BraveSearchClient
    assert pick(web_search_provider="brave") is NoWebSearch  # no key: say so rather than fail every call
    assert pick(web_search_provider="searxng", searxng_url="http://searxng:8080") is SearxngClient
    assert pick(web_search_provider="none") is NoWebSearch
    assert pick(web_search_provider="exa") is ExaSearchClient  # works without a key


async def test_no_web_search_reports_itself_as_unavailable() -> None:
    with pytest.raises(SourceUnavailable, match="not configured"):
        await NoWebSearch().search("site:x.com churn")


@respx.mock
async def test_brave_search_maps_results_and_freshness() -> None:
    route = respx.get("https://api.search.brave.com/res/v1/web/search").respond(
        200,
        json={
            "web": {
                "results": [{"url": "https://x.com/a/status/1", "title": "t", "description": "d"}, {"title": "no url"}]
            },
            "query": {"more_results_available": False},
        },
    )
    config = SourceConfig(web_search_provider="brave", web_search_api_key="key-123")
    client = build_web_search(config, _fetcher(config))
    results = await client.search("site:x.com churn", time_range="month")
    assert results == [{"url": "https://x.com/a/status/1", "title": "t", "content": "d"}]
    request = route.calls.last.request
    assert request.headers["X-Subscription-Token"] == "key-123"
    assert request.url.params["freshness"] == "pm"


@respx.mock
async def test_brave_search_error_is_a_source_outage() -> None:
    respx.get("https://api.search.brave.com/res/v1/web/search").respond(429)
    config = SourceConfig(web_search_provider="brave", web_search_api_key="key")
    with pytest.raises(SourceUnavailable):
        await build_web_search(config, _fetcher(config)).search("site:producthunt.com x")
