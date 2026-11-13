"""A fair, first-come line for graph runs, so a burst of users can't starve the shared LLM budget.

Every validation and content plan calls NVIDIA NIM through one key (40 requests/minute). One run alone keeps
that budget busy for a few minutes, so when 30 people press "Run" at once, letting all 30 execute means each
gets about one LLM call a minute: they all crawl, run out of hand-offs and fail together. Instead, at most
``capacity`` runs execute at a time and the rest wait in line, in the order they were started, with their
place shown to the founder ("3 ahead of you · about 6 min").

Redis (Upstash) holds the line in three keys, changed only by Lua scripts so two workers can't both take the
last slot:

- ``rq:active``  sorted set: run id → lease expiry (ms). A crashed worker's slot frees itself at expiry.
- ``rq:waiting`` sorted set: run id → when it joined the line (ms). Order = fairness.
- ``rq:seen``    hash: run id → last time its delivery asked for a slot (ms). A run nobody has asked about
  for ``stale_ms`` (cancelled, message lost) drops out of the line instead of blocking everyone behind it.

If Redis is unreachable the line fails **open** (the run executes), the same policy as the API's limiters:
a Redis outage must not stop validations.
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import cast

from redis.asyncio import Redis
from redis.exceptions import RedisError

from deno_core.errors import Busy
from deno_core.logging import get_logger
from deno_core.settings import Settings

log = get_logger(__name__)

ACTIVE, WAITING, SEEN = "rq:active", "rq:waiting", "rq:seen"
KEY_TTL_S = 2 * 86400  # the keys clean themselves up if the feature is ever switched off
SCAN_LIMIT = 500  # never walk more of the line than this in one script call

# KEYS: active, waiting, seen. ARGV: run id, now ms, capacity, lease ms, stale ms, key ttl s, scan limit.
# Returns 0 when the run holds a slot, else its place in line (1 = next).
_ACQUIRE = """
local active, waiting, seen = KEYS[1], KEYS[2], KEYS[3]
local id, now = ARGV[1], tonumber(ARGV[2])
local cap, lease, stale = tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5])
local ttl, limit = tonumber(ARGV[6]), tonumber(ARGV[7])
redis.call('ZREMRANGEBYSCORE', active, '-inf', now)
if redis.call('ZSCORE', active, id) then
  redis.call('ZADD', active, now + lease, id)
  redis.call('EXPIRE', active, ttl)
  return 0
end
redis.call('ZADD', waiting, 'NX', now, id)
redis.call('HSET', seen, id, now)
local free = cap - redis.call('ZCARD', active)
local pos = 0
for _, w in ipairs(redis.call('ZRANGE', waiting, 0, limit - 1)) do
  local s = tonumber(redis.call('HGET', seen, w) or '0')
  if w ~= id and s < now - stale then
    redis.call('ZREM', waiting, w)
    redis.call('HDEL', seen, w)
  else
    pos = pos + 1
    if w == id then break end
  end
end
redis.call('EXPIRE', waiting, ttl)
redis.call('EXPIRE', seen, ttl)
if free > 0 and pos <= free then
  redis.call('ZREM', waiting, id)
  redis.call('HDEL', seen, id)
  redis.call('ZADD', active, now + lease, id)
  redis.call('EXPIRE', active, ttl)
  return 0
end
if free < 0 then free = 0 end
return pos - free
"""

# KEYS: waiting, seen. ARGV: run id, now ms, key ttl s. Joins the line (keeps the first join time).
_JOIN = """
redis.call('ZADD', KEYS[1], 'NX', tonumber(ARGV[2]), ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], tonumber(ARGV[2]))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
return redis.call('ZRANK', KEYS[1], ARGV[1])
"""


@dataclass(frozen=True)
class Place:
    """Where a run stands: ``granted`` (it may execute now) or its ``position`` in line (1 = next)."""

    granted: bool
    position: int = 0

    def eta_minutes(self, avg_run_s: float, capacity: int) -> int:
        """Rough wait: everyone ahead (and you) share ``capacity`` slots of ``avg_run_s`` each."""
        if self.granted:
            return 0
        return max(1, math.ceil(self.position * avg_run_s / max(1, capacity) / 60))


def _now_ms() -> int:
    return int(time.time() * 1000)


class RunQueue:
    """See the module docstring. ``capacity`` = runs executing at once; ``lease_s`` must outlast one delivery."""

    def __init__(
        self,
        redis: Redis,
        *,
        capacity: int,
        lease_s: int,
        stale_s: int = 180,
        now: Callable[[], int] = _now_ms,
    ) -> None:
        self.redis, self.capacity = redis, max(1, capacity)
        self.lease_ms, self.stale_ms = lease_s * 1000, stale_s * 1000
        self._now = now

    async def join(self, run_id: str) -> int | None:
        """Put a just-created run in line (the API calls this before enqueueing). Returns how many are ahead
        of it, or None if Redis is down."""
        try:
            rank = await self.redis.eval(_JOIN, 2, WAITING, SEEN, run_id, self._now(), KEY_TTL_S)
        except RedisError:
            log.warning("run_queue_unavailable", op="join")
            return None
        return int(rank) if rank is not None else None

    async def acquire(self, run_id: str) -> Place:
        """Take a slot if one is free and it's this run's turn; otherwise report its place. Re-entrant: a run
        that already holds a slot (a hand-off) keeps it and its lease is renewed."""
        try:
            pos = await self.redis.eval(
                _ACQUIRE,
                3,
                ACTIVE,
                WAITING,
                SEEN,
                run_id,
                self._now(),
                self.capacity,
                self.lease_ms,
                self.stale_ms,
                KEY_TTL_S,
                SCAN_LIMIT,
            )
        except RedisError:
            log.warning("run_queue_unavailable", op="acquire")
            return Place(granted=True)  # fail open
        pos = int(pos)
        return Place(granted=pos == 0, position=pos)

    async def release(self, run_id: str) -> None:
        """The run finished (or was cancelled): free its slot and take it out of line."""
        try:
            async with self.redis.pipeline(transaction=True) as pipe:
                pipe.zrem(ACTIVE, run_id)
                pipe.zrem(WAITING, run_id)
                pipe.hdel(SEEN, run_id)
                await pipe.execute()
        except RedisError:
            log.warning("run_queue_unavailable", op="release")

    async def position(self, run_id: str) -> int | None:
        """Read-only place in line (1 = next), ignoring free slots and stale entries: for status displays.
        None when the run isn't waiting or Redis is down."""
        try:
            rank = await self.redis.zrank(WAITING, run_id)
        except RedisError:
            return None
        return None if rank is None else int(cast(int, rank)) + 1

    async def waiting(self) -> int | None:
        """How many runs are in line (not executing). None if Redis is down."""
        try:
            return int(await self.redis.zcard(WAITING))
        except RedisError:
            return None


def run_queue(redis: Redis, settings: Settings) -> RunQueue:
    """The line with this deployment's settings (one delivery's budget plus slack as the lease)."""
    return RunQueue(redis, capacity=settings.run_queue_slots, lease_s=settings.run_time_budget_s + 150)


async def ensure_room(redis: Redis | None, settings: Settings) -> None:
    """Refuse a new run (503, with a time to come back) when the line is already very long. Checked before the
    run is created, so a refused request costs the founder nothing."""
    if redis is None:
        return
    waiting = await run_queue(redis, settings).waiting()
    if waiting is None or waiting < settings.run_queue_max_waiting:
        return
    eta = Place(granted=False, position=waiting).eta_minutes(settings.run_queue_avg_run_s, settings.run_queue_slots)
    raise Busy(
        f"Deno is very busy: {waiting} validations are already waiting. Try again in about {eta} min; "
        "your idea is saved."
    )


async def join_line(settings: Settings, run_id: str) -> None:
    """Called by ``enqueue``: the run's place is fixed by when it was started, not when the queue delivers it."""
    redis = Redis.from_url(settings.valkey_url)
    try:
        await run_queue(redis, settings).join(run_id)
    finally:
        await redis.aclose()
