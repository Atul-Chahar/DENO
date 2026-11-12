"""Vercel Queues push subscriber: executes graph runs on Vercel (docs/15).

Vercel builds this module into a private, queue-triggered function. Each message on the
``graph-runs`` topic is one run, ``{"task": "validation.run", "kwargs": {"run_id": ..., "user_id": ...}}``.

A run must finish within one function invocation (300 s on Vercel Hobby). Most do. One that doesn't
hands itself off before the platform kills it: the delivery ends with ``RetryAfter(0)``, the queue
redelivers it straight away, and the graph resumes from its Postgres checkpoint. Its status stays
``running`` the whole time, and the run lease is released on the way out, so the next delivery can
take it. Transient upstream failures (NIM rate limits, outages) back off and retry the same way.
"""

from __future__ import annotations

import asyncio
from typing import Any

from redis.asyncio import Redis
from vercel.queue import Message, RetryAfter, subscribe

from deno_core.jobs import GRAPH_RUNS_TOPIC, RETRYABLE
from deno_core.logging import configure_logging, get_logger
from deno_core.observability import init_sentry
from deno_core.settings import get_settings
from deno_worker.handlers import GRAPH_HANDLERS, register_runners

log = get_logger(__name__)

# A run that needs more hand-offs than this is broken, not slow; the daily requeue cron is the backstop.
MAX_ATTEMPTS = 12
TRANSIENT_BACKOFF_S = 30

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
    budget = asyncio.timeout(settings.run_time_budget_s)
    try:
        async with budget:
            await GRAPH_HANDLERS[task](redis, **kwargs)
    except TimeoutError:
        if not budget.expired():
            log.warning("queue_run_transient_timeout", task=task, attempt=attempt)
            raise RetryAfter(TRANSIENT_BACKOFF_S) from None
        # Out of time in this invocation: hand off to the next delivery, which resumes from the checkpoint.
        log.info("queue_run_handoff", task=task, attempt=attempt, budget_s=settings.run_time_budget_s)
        raise RetryAfter(0) from None
    except RETRYABLE:
        log.warning("queue_run_transient_failure", task=task, attempt=attempt, exc_info=True)
        raise RetryAfter(TRANSIENT_BACKOFF_S) from None
    finally:
        await redis.aclose()
