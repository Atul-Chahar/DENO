"""End-to-end check of graph runs on Vercel (docs/15): create a run, queue it, watch it finish.

    uv run python scripts/vercel_queue_smoke.py "An idea ... https://github.com/owner/repo" --deployment dpl_...

Needs DATABASE_URL and VALKEY_URL (the same Supabase/Upstash as the deployment) and a Vercel OIDC token
for the project (``vercel env pull`` writes VERCEL_OIDC_TOKEN to .env.local). The deployed subscriber
executes the run; this script only creates it, sends the message and prints the status every 10 s.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import time
import uuid

from sqlalchemy.ext.asyncio import async_sessionmaker

from deno_core.db.enums import RunStatus
from deno_core.db.repositories import UserScope
from deno_core.db.session import build_engine
from deno_core.jobs import GRAPH_RUNS_TOPIC, TASK_VALIDATION_RUN
from deno_core.settings import get_settings

TERMINAL = {RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED, RunStatus.AWAITING_REVIEW}


def _oidc_token() -> str:
    if token := os.environ.get("VERCEL_OIDC_TOKEN"):
        return token
    with open(".env.local", encoding="utf-8") as env:
        for line in env:
            if line.startswith("VERCEL_OIDC_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("no VERCEL_OIDC_TOKEN: run `vercel env pull` first")


async def main() -> None:
    from vercel.queue import QueueClient

    ap = argparse.ArgumentParser()
    ap.add_argument("idea")
    ap.add_argument("--deployment", required=True, help="dpl_… of the deployment whose subscriber runs it")
    ap.add_argument("--region", default="hnd1")
    args = ap.parse_args()

    settings = get_settings()
    maker = async_sessionmaker(build_engine(settings.database_url), expire_on_commit=False)
    user = uuid.uuid4()
    async with maker() as s, s.begin():
        scope = UserScope(s, user)
        await scope.ensure_profile()
        project = await scope.create_project(args.idea)
        run, _ = await scope.create_run(project.id)
    print(f"run {run.id} created")

    queue = QueueClient(region=args.region, token=_oidc_token(), deployment=args.deployment)
    kwargs = {"run_id": str(run.id), "user_id": str(user)}
    message_id = await queue.send(GRAPH_RUNS_TOPIC, {"task": TASK_VALIDATION_RUN, "kwargs": kwargs})
    print(f"queued as {message_id}")

    started = time.monotonic()
    while True:
        await asyncio.sleep(10)
        async with maker() as s:
            current = await UserScope(s, user).get_run(run.id)
        elapsed = time.monotonic() - started
        print(f"{elapsed:5.0f}s  {current.status.value}")
        if current.status in TERMINAL:
            break
        if elapsed > 900:
            raise SystemExit("still not finished after 15 minutes")
    print(f"done in {time.monotonic() - started:.0f}s: {current.status.value}")


if __name__ == "__main__":
    asyncio.run(main())
