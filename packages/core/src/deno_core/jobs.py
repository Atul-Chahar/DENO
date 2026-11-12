"""Background job contract shared by the API (enqueues) and whatever executes the job.

- Production (docs/15): TASK_RUNNER=vercel_queue. Each graph run is one Vercel Queues message on the
  ``graph-runs`` topic; a push subscriber (``deno_api.queue_worker``) executes it. A delivery that
  fails or runs out of time is redelivered and the graph resumes from its LangGraph checkpoint.
- Local development: taskiq on Valkey Streams (ADR-004) and a worker process.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from taskiq import AsyncBroker, InMemoryBroker
from taskiq.kicker import AsyncKicker
from taskiq.middlewares import SmartRetryMiddleware
from taskiq_redis import RedisStreamBroker

from deno_core.errors import RateLimited, UpstreamUnavailable
from deno_core.settings import get_settings

TASK_VALIDATION_RUN = "validation.run"
TASK_CONTENT_PLAN = "content.plan"
TASK_PURGE_SCRAPED_TEXT = "maintenance.purge_scraped_text"
TASK_REQUEUE_STALE_RUNS = "maintenance.requeue_stale_runs"
# The Vercel Queues topic graph runs travel on (docs/15).
GRAPH_RUNS_TOPIC = "graph-runs"

# Longest a job may run before another worker re-claims it (validation p95 target is 4 min).
JOB_IDLE_TIMEOUT_MS = 15 * 60 * 1000

# Only transient failures are retried; everything else fails the run once.
RETRYABLE: tuple[type[BaseException], ...] = (UpstreamUnavailable, RateLimited, ConnectionError, TimeoutError)


def build_broker(url: str | None = None, *, in_memory: bool = False) -> AsyncBroker:
    broker: AsyncBroker
    if in_memory:
        broker = InMemoryBroker()
    else:
        broker = RedisStreamBroker(
            url=url or get_settings().valkey_url,
            queue_name="deno:jobs",
            consumer_group_name="deno-workers",
            idle_timeout=JOB_IDLE_TIMEOUT_MS,
            maxlen=10_000,
        )
    return broker.with_middlewares(
        SmartRetryMiddleware(
            default_retry_count=2,
            default_retry_label=True,
            use_jitter=True,
            use_delay_exponent=True,
            default_delay=5,
            max_delay_exponent=60,
            types_of_exceptions=RETRYABLE,
        )
    )


@lru_cache(maxsize=1)
def get_broker() -> AsyncBroker:
    return build_broker(in_memory=get_settings().environment == "test")


async def enqueue(task_name: str, broker: AsyncBroker | None = None, **kwargs: Any) -> str:
    """Send a job by name (the API never imports worker code). Returns the job id.

    With TASK_RUNNER=vercel_queue the job is a Vercel Queues message instead, executed by a push
    subscriber function, so no worker has to stay running (docs/15). The idempotency key makes a
    double submit of the same run one message.
    """
    settings = get_settings()
    if broker is None and settings.task_runner == "vercel_queue":
        from vercel.queue import send

        key = f"{task_name}:{json.dumps(kwargs, sort_keys=True)}"
        message_id = await send(GRAPH_RUNS_TOPIC, {"task": task_name, "kwargs": kwargs}, idempotency_key=key)
        return message_id or key
    kicker: AsyncKicker[Any, Any] = AsyncKicker(task_name, broker or get_broker(), {})
    task = await kicker.kiq(**kwargs)
    return str(task.task_id)
