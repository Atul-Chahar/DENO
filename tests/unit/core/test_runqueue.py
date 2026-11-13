"""The fair line for graph runs (deno_core.runqueue): order, capacity, crash recovery, stale entries."""

from __future__ import annotations

import fakeredis
import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from deno_core import runqueue
from deno_core.errors import Busy
from deno_core.runqueue import Place, RunQueue, ensure_room
from deno_core.settings import Settings


class Clock:
    def __init__(self) -> None:
        self.ms = 1_000_000

    def __call__(self) -> int:
        return self.ms

    def advance(self, s: float) -> None:
        self.ms += int(s * 1000)


def line(capacity: int = 2, clock: Clock | None = None) -> tuple[RunQueue, fakeredis.FakeAsyncRedis, Clock]:
    clock = clock or Clock()
    r = fakeredis.FakeAsyncRedis()
    return RunQueue(r, capacity=capacity, lease_s=400, stale_s=180, now=clock), r, clock


async def test_first_come_first_served_within_capacity() -> None:
    q, _, clock = line(capacity=2)
    for run in ("a", "b", "c", "d"):
        await q.join(run)
        clock.advance(1)
    # Deliveries arrive out of order; the line keeps the start order.
    assert await q.acquire("d") == Place(False, 2)
    assert await q.acquire("c") == Place(False, 1)  # a and b haven't asked yet but are ahead
    assert (await q.acquire("a")).granted
    assert (await q.acquire("b")).granted
    assert await q.acquire("c") == Place(False, 1)  # full: next in line
    await q.release("a")
    assert await q.acquire("d") == Place(False, 1)  # c is still ahead of d
    assert (await q.acquire("c")).granted
    assert await q.waiting() == 1


async def test_a_slot_is_reentrant_and_renewed() -> None:
    q, _, clock = line(capacity=1)
    assert (await q.acquire("a")).granted
    clock.advance(390)
    assert (await q.acquire("a")).granted  # a hand-off renews the lease
    clock.advance(390)
    assert not (await q.acquire("b")).granted  # still held: renewed 390 s ago, lease 400 s


async def test_a_crashed_runs_slot_frees_itself() -> None:
    q, _, clock = line(capacity=1)
    assert (await q.acquire("a")).granted
    clock.advance(401)  # no renewal: the worker died
    assert (await q.acquire("b")).granted


async def test_runs_nobody_asks_about_drop_out_of_line() -> None:
    q, _, clock = line(capacity=1)
    assert (await q.acquire("busy")).granted
    await q.join("lost")  # its message never arrives
    clock.advance(1)
    await q.join("me")
    assert await q.acquire("me") == Place(False, 2)
    clock.advance(200)  # "lost" is stale now; "me" keeps asking
    assert await q.acquire("me") == Place(False, 1)


async def test_eta() -> None:
    assert Place(True).eta_minutes(240, 2) == 0
    assert Place(False, 1).eta_minutes(240, 2) == 2
    assert Place(False, 5).eta_minutes(240, 2) == 10
    assert Place(False, 1).eta_minutes(30, 4) == 1  # never "0 min" while waiting


class Down:
    async def eval(self, *_a: object) -> None:
        raise RedisConnectionError("down")

    async def zcard(self, *_a: object) -> None:
        raise RedisConnectionError("down")

    async def zrank(self, *_a: object) -> None:
        raise RedisConnectionError("down")

    def pipeline(self, **_kw: object) -> None:
        raise RedisConnectionError("down")


async def test_a_redis_outage_fails_open() -> None:
    q = RunQueue(Down(), capacity=1, lease_s=400)  # type: ignore[arg-type]
    assert (await q.acquire("a")).granted
    assert await q.join("a") is None
    assert await q.waiting() is None
    await q.release("a")  # no error


async def test_a_very_long_line_refuses_new_runs_politely(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(_env_file=None, environment="test", run_queue_max_waiting=3, run_queue_capacity=2)  # type: ignore[call-arg]
    r = fakeredis.FakeAsyncRedis()
    q = runqueue.run_queue(r, settings)
    for run in ("a", "b"):
        await q.join(run)
    await ensure_room(r, settings)  # 2 waiting < 3: fine
    await q.join("c")
    with pytest.raises(Busy, match=r"3 validations are already waiting.*about 6 min.*your idea is saved"):
        await ensure_room(r, settings)
    await ensure_room(None, settings)  # no Redis configured: never refuses
    await ensure_room(Down(), settings)  # type: ignore[arg-type]  # Redis down: never refuses


async def test_read_only_position_for_status_displays() -> None:
    q, _, clock = line(capacity=1)
    await q.join("a")
    clock.advance(1)
    await q.join("b")
    assert await q.position("b") == 2
    assert await q.position("nobody") is None
    assert await RunQueue(Down(), capacity=1, lease_s=1).position("a") is None  # type: ignore[arg-type]
