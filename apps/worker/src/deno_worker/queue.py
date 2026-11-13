"""Vercel Queues push subscriber: executes graph runs on Vercel (docs/15).

Vercel builds this module into a private, queue-triggered function. Each message on the
``graph-runs`` topic is one run, ``{"task": "validation.run", "kwargs": {"run_id": ..., "user_id": ...}}``.

A run must finish within one function invocation (300 s on Vercel Hobby). Most do. One that doesn't
hands itself off before the platform kills it: the delivery ends with ``RetryAfter(0)``, the queue
redelivers it straight away, and the graph resumes from its Postgres checkpoint. Its status stays
``running`` the whole time, and the run lease is released on the way out, so the next delivery can
take it. Transient upstream failures (NIM rate limits, outages) back off and retry the same way.

Before any of that, a run takes a slot in the fair line (``deno_core.runqueue``): only a few runs execute at
once, because they all share one NIM key. A run whose turn hasn't come publishes its place ("3 ahead of you ·
about 6 min") to its event stream and asks the queue to deliver it again shortly. Waiting deliveries don't
count as hand-offs; hand-offs are counted separately so a broken run still stops.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError
from vercel.queue import Message, RetryAfter, subscribe

from deno_core.events import RunEvent, RunEvents
from deno_core.jobs import GRAPH_RUNS_TOPIC, RETRYABLE
from deno_core.logging import configure_logging, get_logger
from deno_core.observability import init_sentry
from deno_core.runqueue import Place, run_queue
from deno_core.settings import Settings, get_settings
from deno_worker.handlers import GRAPH_HANDLERS, register_runners

log = get_logger(__name__)

# A run that needs more hand-offs than this is broken, not slow; the daily requeue cron is the backstop.
MAX_HANDOFFS = 6  # a healthy run needs 0-2; 6 × 270 s is about half an hour of work
# Deliveries in total, waiting in line included: a 30 s retry for 6 h. Our own subscriber enforces it.
MAX_ATTEMPTS = 720
TRANSIENT_BACKOFF_S = 30


def handoff_key(run_id: str) -> str:
    return f"run:{run_id}:handoffs"


def wait_seconds(place: Place) -> int:
    """How long a waiting run sleeps before asking again: soon when it's next, less often further back."""
    return max(10, min(60, 10 + 5 * place.position))


def queue_message(place: Place, settings: Settings) -> str:
    ahead = place.position
    eta = place.eta_minutes(settings.run_queue_avg_run_s, settings.run_queue_slots)
    who = "You're next" if ahead == 1 else f"{ahead - 1} validation{'s' if ahead > 2 else ''} ahead of you"
    return (
        f"Waiting in line: {who} · about {eta} min. Deno runs a few validations at a time so each one finishes. "
        "You can close this tab: it runs either way."
    )


_ready = False


def _setup() -> None:
    global _ready
    if not _ready:
        configure_logging()
        init_sentry(get_settings(), "worker")
        register_runners()
        _ready = True


@subscribe(topic=GRAPH_RUNS_TOPIC, max_attempts=MAX_ATTEMPTS, retry_after=5)
async def run_graph(message: Message[dict[str, Any]]) -> None:
    _setup()
    payload = message.payload if isinstance(message.payload, dict) else {}
    task, kwargs = payload.get("task"), payload.get("kwargs")
    if task not in GRAPH_HANDLERS or not isinstance(kwargs, dict):
        log.error("queue_bad_message", task=task)  # acknowledged: no retry would help
        return
    attempt = message.metadata.delivery_count
    settings = get_settings()
    redis = Redis.from_url(settings.valkey_url)
    run_id = str(kwargs.get("run_id") or kwargs.get("plan_id") or "")
    line = run_queue(redis, settings)
    done = True  # release the slot on the way out unless the run continues in a later delivery
    try:
        place = await line.acquire(run_id) if run_id else Place(granted=True)
        if not place.granted:
            if await RunEvents(redis).is_cancelled(run_id):
                log.info("queue_run_cancelled_while_waiting", task=task)
                return  # acknowledged; `done` releases its place in line
            done = False
            await _announce(redis, run_id, place, settings)
            log.info("queue_run_waiting", task=task, position=place.position, attempt=attempt)
            raise RetryAfter(wait_seconds(place))
        budget = asyncio.timeout(settings.run_time_budget_s)
        try:
            async with budget:
                await GRAPH_HANDLERS[task](redis, **kwargs)
        except TimeoutError:
            if not budget.expired():
                log.warning("queue_run_transient_timeout", task=task, attempt=attempt)
                done = False
                raise RetryAfter(TRANSIENT_BACKOFF_S) from None
            # Out of time in this invocation: hand off to the next delivery, which resumes from the checkpoint.
            handoffs = await _count_handoff(redis, run_id)
            if handoffs > MAX_HANDOFFS:
                log.error("queue_run_too_many_handoffs", task=task, handoffs=handoffs)
                return  # acknowledged; the requeue cron is the backstop (as before)
            log.info("queue_run_handoff", task=task, attempt=attempt, budget_s=settings.run_time_budget_s)
            done = False
            raise RetryAfter(0) from None
        except RETRYABLE:
            log.warning("queue_run_transient_failure", task=task, attempt=attempt, exc_info=True)
            done = False
            raise RetryAfter(TRANSIENT_BACKOFF_S) from None
    finally:
        if done and run_id:
            await line.release(run_id)
        await redis.aclose()


async def _announce(redis: Redis, run_id: str, place: Place, settings: Settings) -> None:
    """Tell whoever watches the run where it stands (the web shows it; the MCP reads the run status)."""
    eta = place.eta_minutes(settings.run_queue_avg_run_s, settings.run_queue_slots)
    with contextlib.suppress(RedisError):
        await RunEvents(redis).publish(
            run_id,
            RunEvent(
                type="queue",
                data={"position": place.position, "eta_minutes": eta, "message": queue_message(place, settings)},
            ),
        )


async def _count_handoff(redis: Redis, run_id: str) -> int:
    if not run_id:
        return 0
    try:
        n = int(await redis.incr(handoff_key(run_id)))
        await redis.expire(handoff_key(run_id), 86400)
    except RedisError:
        return 0
    return n
