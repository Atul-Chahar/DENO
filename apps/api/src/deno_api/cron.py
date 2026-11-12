"""Maintenance endpoints for Vercel Cron Jobs (docs/15).

Vercel Cron calls each path with GET and ``Authorization: Bearer $CRON_SECRET``. The secret is
compared in constant time, so a leaked URL alone can't trigger anything. With CRON_SECRET empty the
endpoints answer 404 (local development runs maintenance through the taskiq scheduler instead).
POST is accepted too, so the jobs can be run by hand with curl.
"""

from __future__ import annotations

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from deno_api.deps import get_sessionmaker
from deno_core import maintenance
from deno_core.settings import Settings, get_settings

router = APIRouter(prefix="/internal/cron", tags=["ops"], include_in_schema=False)


def _settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", None) or get_settings()


async def require_cron(request: Request) -> None:
    secret = _settings(request).cron_secret.get_secret_value()
    if not secret:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing cron token.")
    if not hmac.compare_digest(token.strip().encode(), secret.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid cron token.")


Maker = Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)]


@router.api_route("/purge", methods=["GET", "POST"], dependencies=[Depends(require_cron)])
async def purge(maker: Maker) -> dict[str, int]:
    return {"purged": await maintenance.purge_old_scraped_text(maker)}


@router.api_route("/requeue", methods=["GET", "POST"], dependencies=[Depends(require_cron)])
async def requeue(maker: Maker) -> dict[str, int]:
    return {"requeued": await maintenance.requeue_stale_runs(maker)}
