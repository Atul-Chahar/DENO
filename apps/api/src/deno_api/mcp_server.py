"""Deno's MCP server: the founder's own Claude or ChatGPT works with their Deno data (docs/16).

Mounted on the API at ``/mcp`` (Streamable HTTP, stateless, so it runs in a serverless function).
Auth is OAuth 2.1 with Supabase Auth as the authorization server: Claude/ChatGPT discover it from
``/.well-known/oauth-protected-resource/mcp``, register themselves, send the founder through our
consent screen (``/oauth/consent`` on deno-web) and call us with a Supabase JWT. Every tool acts as that
founder through ``UserScope``, so it reads and writes exactly what the dashboard shows.

v1 tools: list ideas, read a report, read founder context, start a validation (run by Deno), check it.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import jwt
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.applications import Starlette

from deno_api.auth import InvalidToken, _build_verifier
from deno_api.deps import _has_verified_factor
from deno_core.db.enums import RunStatus, UsageKind
from deno_core.db.repositories import UserScope
from deno_core.errors import DenoError
from deno_core.jobs import TASK_VALIDATION_RUN, enqueue
from deno_core.logging import get_logger
from deno_core.settings import Settings

log = get_logger(__name__)

MCP_PATH = "/mcp"
INSTRUCTIONS = """Deno validates startup ideas against real public evidence (Reddit, Hacker News, GitHub,
the founder's own website) and turns validated ideas into a content plan. Everything you read or create here
is the founder's own Deno data and also appears on their Deno dashboard.

- list_ideas: the founder's ideas with their latest verdict.
- validate_idea: start a validation (Deno collects evidence and computes the verdict; takes ~3-4 minutes).
- get_validation: check a validation's progress; when it's done, get_report has the result.
- get_report: verdict, confidence, signals and every claim with the source it cites. Quote claims with their
  source URLs; never invent evidence.
- get_founder_context: what Deno knows about this idea and founder (pains, ICP, stories) for writing content.
"""


class SupabaseOAuthVerifier:
    """Validates Supabase-issued access tokens (OAuth server or a normal web session) for the MCP server."""

    def __init__(self, maker: Callable[[], async_sessionmaker[AsyncSession] | None]) -> None:
        self._maker = maker

    async def verify_token(self, token: str) -> AccessToken | None:
        verifier = _build_verifier()
        if verifier is None:
            return None
        try:
            user = await run_in_threadpool(verifier.verify, token)
            user_id = uuid.UUID(user.id)
        except (InvalidToken, ValueError):
            return None
        # Same rule as the web API: a password-only session of a user who enrolled 2FA gets nothing.
        maker = self._maker()
        if user.aal != "aal2" and maker is not None and await _has_verified_factor(maker, user_id):
            log.info("mcp_token_needs_mfa", user_id=str(user_id))
            return None
        claims: dict[str, Any] = jwt.decode(token, options={"verify_signature": False})  # verified above
        return AccessToken(
            token=token,
            client_id=str(claims.get("client_id") or "supabase-session"),
            scopes=str(claims.get("scope") or "").split(),
            expires_at=claims.get("exp"),
            subject=str(user_id),
            claims={"iss": claims.get("iss"), "aal": user.aal},
        )


def build_mcp(app: FastAPI, settings: Settings) -> tuple[MCPServer[Any], Starlette] | None:
    """The MCP server and its ASGI app, or None when auth isn't configured (local dev without Supabase)."""
    if not settings.supabase_url:
        return None
    api = settings.api_url.rstrip("/")
    dashboard = settings.app_url.rstrip("/")
    mcp: MCPServer[Any] = MCPServer(
        name="Deno",
        title="Deno: validate ideas, then launch them",
        instructions=INSTRUCTIONS,
        website_url=dashboard,
        token_verifier=SupabaseOAuthVerifier(lambda: getattr(app.state, "sessionmaker", None)),
        auth=AuthSettings(
            issuer_url=f"{settings.supabase_url.rstrip('/')}/auth/v1",
            resource_server_url=f"{api}{MCP_PATH}",
            service_documentation_url=f"{dashboard}",
            # Supabase access tokens carry aud="authenticated", which SupabaseOAuthVerifier checks.
            validate_token_resource=False,
        ),
    )

    async def as_founder[T](work: Callable[[UserScope], Awaitable[T]]) -> T:
        token = get_access_token()
        if token is None or token.subject is None:
            raise PermissionError("Sign in to Deno first.")
        maker: async_sessionmaker[AsyncSession] | None = getattr(app.state, "sessionmaker", None)
        if maker is None:
            raise RuntimeError("Deno's database isn't configured.")
        try:
            async with maker() as session, session.begin():
                return await work(UserScope(session, uuid.UUID(token.subject)))
        except DenoError as exc:  # NotFound, QuotaExceeded, … : tell the model in plain words
            raise ValueError(str(exc) or type(exc).__name__) from None

    def idea_link(project_id: uuid.UUID) -> str:
        return f"{dashboard}/app?project={project_id}"

    @mcp.tool(title="List my ideas")
    async def list_ideas(limit: int = 20) -> list[dict[str, Any]]:
        """The founder's ideas, newest first, each with its latest validation (status, verdict, confidence)."""

        async def work(scope: UserScope) -> list[dict[str, Any]]:
            page = await scope.list_projects(limit=max(1, min(limit, 50)), cursor=None)
            latest = await scope.latest_runs([p.id for p in page.items])
            out = []
            for p in page.items:
                item: dict[str, Any] = {
                    "idea_id": str(p.id),
                    "idea": p.idea[:500],
                    "created_at": p.created_at.isoformat(),
                    "dashboard_url": idea_link(p.id),
                }
                if p.id in latest:
                    run, verdict = latest[p.id]
                    item["latest_validation"] = {
                        "run_id": str(run.id),
                        "status": run.status.value,
                        "verdict": verdict.verdict.value if verdict else None,
                        "confidence": verdict.confidence if verdict else None,
                    }
                out.append(item)
            return out

        return await as_founder(work)

    @mcp.tool(title="Validate an idea")
    async def validate_idea(idea: str) -> dict[str, Any]:
        """Start a Deno validation of a startup idea (a few sentences; may include the product's website or
        GitHub repo URL). Deno collects public evidence and computes a verdict in about 3-4 minutes. Poll
        get_validation with the returned run_id. Counts toward the founder's monthly validations."""
        from deno_api.v1.projects import _check_quota

        text = idea.strip()
        if len(text) < 20:
            raise ValueError("Describe the idea in at least a sentence or two.")

        async def work(scope: UserScope) -> dict[str, Any]:
            await scope.ensure_profile()
            project = await scope.create_project(text[:4000], None)
            await _check_quota(scope)
            run, _ = await scope.create_run(project.id, None)
            await scope.record_usage(UsageKind.VALIDATION_RUN, run_id=run.id)
            return {"idea_id": str(project.id), "run_id": str(run.id), "user_id": str(scope.user_id)}

        created = await as_founder(work)
        # After the transaction commits, so the queue worker finds the row (the requeue cron repairs a lost send).
        await enqueue(TASK_VALIDATION_RUN, run_id=created["run_id"], user_id=created.pop("user_id"))
        return {
            **created,
            "status": RunStatus.QUEUED.value,
            "dashboard_url": idea_link(uuid.UUID(created["idea_id"])),
            "next": "Call get_validation with run_id in about a minute.",
        }

    @mcp.tool(title="Check a validation")
    async def get_validation(run_id: str) -> dict[str, Any]:
        """Progress of a validation: queued, running, awaiting_review (done), succeeded, failed or cancelled."""

        async def work(scope: UserScope) -> dict[str, Any]:
            run = await scope.get_run(uuid.UUID(run_id))
            done = run.status in (RunStatus.AWAITING_REVIEW, RunStatus.SUCCEEDED)
            return {
                "run_id": str(run.id),
                "status": run.status.value,
                "done": done,
                "error_code": run.error_code,
                "dashboard_url": idea_link(run.project_id),
                "next": "Call get_report." if done else "Check again in a minute.",
            }

        return await as_founder(work)

    @mcp.tool(title="Read a validation report")
    async def get_report(run_id: str, max_claims: int = 30) -> dict[str, Any]:
        """The verdict (build / pivot / kill / insufficient evidence), confidence, signals, and the verified
        claims, each with the public source (URL) that supports it."""

        async def work(scope: UserScope) -> dict[str, Any]:
            rid = uuid.UUID(run_id)
            run = await scope.get_run(rid)
            verdict = await scope.get_verdict(rid)
            claims = await scope.list_claims_with_evidence(rid)
            return {
                "run_id": run_id,
                "status": run.status.value,
                "verdict": verdict.verdict.value if verdict else None,
                "confidence": verdict.confidence if verdict else None,
                "rationale": verdict.rationale if verdict else None,
                "reasons": verdict.reasons if verdict else [],
                "signals": {s.name: s.value for s in await scope.list_signals(rid)},
                "claims": [
                    {
                        "analyst": c.analyst,
                        "stance": c.stance.value,
                        "claim": c.text,
                        "sources": [
                            {"url": doc.url, "source": doc.source.value, "quote": chunk.text[:400]}
                            for _cit, chunk, doc in cites
                        ][:3],
                    }
                    for c, cites in claims[: max(1, min(max_claims, 100))]
                ],
                "dashboard_url": idea_link(run.project_id),
            }

        return await as_founder(work)

    @mcp.tool(title="Founder context for content")
    async def get_founder_context(idea_id: str) -> dict[str, Any]:
        """What Deno knows for writing this founder's content: the idea, its latest verdict, the strongest
        evidenced pains and ICP claims (with sources), and the founder's Story Bank (real stories and numbers
        they may use). Write only from these facts; don't invent stories or numbers."""

        async def work(scope: UserScope) -> dict[str, Any]:
            project = await scope.get_project(uuid.UUID(idea_id))
            latest = (await scope.latest_runs([project.id])).get(project.id)
            context: dict[str, Any] = {"idea_id": idea_id, "idea": project.idea, "dashboard_url": idea_link(project.id)}
            if latest:
                run, verdict = latest
                context["verdict"] = verdict.verdict.value if verdict else None
                claims = await scope.list_claims_with_evidence(run.id)
                context["evidence"] = [
                    {"analyst": c.analyst, "claim": c.text, "sources": [doc.url for _cit, _chunk, doc in cites][:2]}
                    for c, cites in claims
                    if c.analyst in ("pain", "icp", "demand") and not c.flagged_wrong
                ][:15]
            context["stories"] = [
                {"headline": s.headline, "details": s.details[:600], "numbers": s.numbers}
                for s in (await scope.list_stories())[:20]
            ]
            return context

        return await as_founder(work)

    # DNS-rebinding protection guards servers on localhost; this one is public, behind TLS and OAuth, and is
    # reached through several Vercel hostnames.
    asgi = mcp.streamable_http_app(
        streamable_http_path=MCP_PATH,
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    return mcp, asgi
