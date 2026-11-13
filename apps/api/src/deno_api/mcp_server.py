"""Deno's MCP server: the founder's own Claude or ChatGPT works with their Deno data (docs/16, docs/18).

Mounted on the API at ``/mcp`` (Streamable HTTP, stateless, so it runs in a serverless function).
Auth is OAuth 2.1 with Supabase Auth as the authorization server: Claude/ChatGPT discover it from
``/.well-known/oauth-protected-resource/mcp``, register themselves, send the founder through our
consent screen (``/oauth/consent`` on deno-web) and call us with a Supabase JWT. Every tool acts as that
founder through ``UserScope``, so it reads and writes exactly what the dashboard shows.

Tools (docs/18 §3), kept to about 20 so models pick well:
- ideas: list_ideas, validate_idea, get_validation, get_report, get_founder_context
- posts: check_copy, create_content_plan, list_briefs, save_draft
- studio: set_brand_kit, get_playbook, list_styles, search_recipes, search_media, create_upload, save_video,
  list_studio, get_review_notes, reply_note
Heavy work (rendering, audio analysis, captions, voice) runs on the founder's machine with the studio kit.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Any, Literal, cast

import jwt
from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.settings import AuthSettings
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.applications import Starlette

from deno_api import studio_service as svc
from deno_api.auth import InvalidToken, _build_verifier
from deno_api.deps import _has_verified_factor
from deno_core.db.enums import DraftStatus, Platform, RunStatus, UsageKind
from deno_core.db.repositories import UserScope
from deno_core.errors import DenoError
from deno_core.jobs import TASK_VALIDATION_RUN, enqueue
from deno_core.logging import get_logger
from deno_core.settings import Settings
from deno_gates import GateContext, compute_adaptive_threshold, run_gates, score_quality
from deno_studio import get_doc, list_docs, media, rulebook, search_docs

log = get_logger(__name__)

MCP_PATH = "/mcp"
Group = Literal["read", "write"]
READ_ONLY = ToolAnnotations(readOnlyHint=True, openWorldHint=False)
INSTRUCTIONS = """Deno validates startup ideas against real public evidence and helps the founder launch them with
posts, videos and images that don't read as AI. Everything here is the founder's own Deno data and shows up on
their Deno dashboard.

Start with list_ideas and get_founder_context: the founder's evidenced pains, their ICP's words, their real stories
and numbers, their voice and brand. Write only from these facts; never invent numbers, quotes or features.

Posts: create_content_plan, then save_draft per brief (Deno's anti-slop gates check every draft).
Video and images: get_playbook and list_styles first, search_media for licensed stock/SFX, then build and render on
the founder's machine with the Deno Studio kit (Claude Code plugin `deno-studio`; `studio` command). save_video
stores a version and returns a review link; get_review_notes returns the founder's frame-pinned notes.
In claude.ai or other chats without the kit, plan the film (treatment, copy, shot list), check copy with
check_copy, and tell the founder to finish rendering in Claude Code."""


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


def _uuid(value: str, what: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value).strip())
    except ValueError:
        raise ValueError(f"{what} must be an id from Deno (a UUID).") from None


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

    def redis() -> Any:
        return getattr(app.state, "redis", None)

    async def caller() -> tuple[uuid.UUID, str | None]:
        token = get_access_token()
        if token is None or token.subject is None:
            raise PermissionError("Sign in to Deno first.")
        return uuid.UUID(token.subject), await svc.client_label(settings, redis(), token.client_id)

    async def as_founder[T](work: Callable[[UserScope, str | None], Awaitable[T]], group: Group = "read") -> T:
        user_id, client = await caller()
        limit = settings.mcp_reads_per_minute if group == "read" else settings.mcp_writes_per_minute
        maker: async_sessionmaker[AsyncSession] | None = getattr(app.state, "sessionmaker", None)
        if maker is None:
            raise RuntimeError("Deno's database isn't configured.")
        try:
            await svc.hit_limit(redis(), f"mcp:{group}:{user_id}", limit, 60, "requests")
            async with maker() as session, session.begin():
                return await work(UserScope(session, user_id), client)
        except DenoError as exc:  # NotFound, QuotaExceeded, … : tell the model in plain words
            raise ValueError(str(exc) or type(exc).__name__) from None

    def idea_link(project_id: uuid.UUID) -> str:
        return f"{dashboard}/app?project={project_id}"

    def studio_link(item_id: str) -> str:
        return f"{dashboard}/app/studio/{item_id}"

    # ------------------------------------------------------------------ ideas

    @mcp.tool(title="List my ideas", annotations=READ_ONLY)
    async def list_ideas(limit: int = 20) -> list[dict[str, Any]]:
        """The founder's ideas, newest first, each with its latest validation (status, verdict, confidence)."""

        async def work(scope: UserScope, _client: str | None) -> list[dict[str, Any]]:
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

        async def work(scope: UserScope, client: str | None) -> dict[str, Any]:
            await scope.ensure_profile()
            project = await scope.create_project(text[:4000], None)
            await _check_quota(scope)
            run, _ = await scope.create_run(project.id, None, client_name=client)
            await scope.record_usage(UsageKind.VALIDATION_RUN, run_id=run.id)
            return {"idea_id": str(project.id), "run_id": str(run.id), "user_id": str(scope.user_id)}

        created = await as_founder(work, "write")
        # After the transaction commits, so the queue worker finds the row (the requeue cron repairs a lost send).
        await enqueue(TASK_VALIDATION_RUN, run_id=created["run_id"], user_id=created.pop("user_id"))
        return {
            **created,
            "status": RunStatus.QUEUED.value,
            "dashboard_url": idea_link(uuid.UUID(created["idea_id"])),
            "next": "Call get_validation with run_id in about a minute.",
        }

    @mcp.tool(title="Check a validation", annotations=READ_ONLY)
    async def get_validation(run_id: str) -> dict[str, Any]:
        """Progress of a validation: queued, running, awaiting_review (done), succeeded, failed or cancelled."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            run = await scope.get_run(_uuid(run_id, "run_id"))
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

    @mcp.tool(title="Read a validation report", annotations=READ_ONLY)
    async def get_report(run_id: str, max_claims: int = 30) -> dict[str, Any]:
        """The verdict (build / pivot / kill / insufficient evidence), confidence, signals, and the verified
        claims, each with the public source (URL) that supports it."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            rid = _uuid(run_id, "run_id")
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

    @mcp.tool(title="Founder context for content", annotations=READ_ONLY)
    async def get_founder_context(idea_id: str) -> dict[str, Any]:
        """What Deno knows for making this founder's content: the idea, its verdict, the strongest evidenced
        pains and ICP claims (with sources and quotes), their Story Bank (real stories and numbers), their voice
        samples, the brand kit (colours, fonts, logo) and their taste (what they've asked to fix before). Write
        only from these facts; don't invent stories or numbers."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            return await svc.founder_context(scope, _uuid(idea_id, "idea_id"), dashboard)

        return await as_founder(work)

    # ------------------------------------------------------------------ posts

    @mcp.tool(title="Check copy against Deno's gates", annotations=READ_ONLY)
    async def check_copy(
        text: str,
        kind: Literal["post", "on_screen", "captions", "voiceover"] = "post",
        platform: Literal["linkedin", "reddit", "x", "hn"] = "linkedin",
        idea_id: str | None = None,
    ) -> dict[str, Any]:
        """Run Deno's anti-slop gates on text without saving anything. kind=post checks a social post for the
        platform (AI tells, invented numbers, ban risks); on_screen / captions / voiceover check video copy (one
        line per screen or caption) with words-per-screen limits. With idea_id, numbers from that idea's evidence
        and the Story Bank are allowed. Fix every finding with severity "block"."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            project_id = _uuid(idea_id, "idea_id") if idea_id else None
            if project_id:
                await scope.get_project(project_id)
            if kind != "post":
                return await svc.check_copy(scope, text, kind, project_id)
            nums, words = await svc.allowed_numbers(scope, project_id)
            report = run_gates(
                text[:6000],
                GateContext(platform=platform, allowed_numbers=nums, allowed_number_words=words, check_numbers=True),
            )
            layers = cast(list[dict[str, Any]], report.to_dict()["layers"])
            findings = [
                {k: f[k] for k in ("rule_id", "severity", "message", "quote", "fix")} | {"layer": layer["layer"]}
                for layer in layers
                for f in layer["findings"]
            ]
            return {
                "passed": report.passed,
                "kind": kind,
                "blocking": sum(1 for f in findings if f["severity"] == "block"),
                "warnings": sum(1 for f in findings if f["severity"] != "block"),
                "findings": findings,
            }

        return await as_founder(work)

    @mcp.tool(title="Create a content plan")
    async def create_content_plan(idea_id: str, briefs: list[dict[str, Any]]) -> dict[str, Any]:
        """Put a plan you wrote into the founder's Deno calendar. briefs: 1-30 items of {day (1-30), platform
        (linkedin|reddit|x|hn), angle (what the post says, 1-3 sentences), hook (optional, short), is_promotional
        (bool; keep at most 1 in 5), story_id (optional: a Story Bank id from get_founder_context; required for any
        first-person story)}. Returns brief ids; then write each post and call save_draft. Counts as one content
        plan on the founder's monthly quota."""
        from deno_api.v1.content import _check_plan_quota

        if not 1 <= len(briefs) <= 30:
            raise ValueError("Give between 1 and 30 briefs.")

        async def work(scope: UserScope, client: str | None) -> dict[str, Any]:
            project_id = _uuid(idea_id, "idea_id")
            await scope.get_project(project_id)
            await _check_plan_quota(scope)
            stories = {str(s.id) for s in await scope.list_stories()}
            rows: list[dict[str, Any]] = []
            for i, b in enumerate(briefs, 1):
                try:
                    platform = Platform(str(b.get("platform", "linkedin")).lower())
                except ValueError:
                    raise ValueError(f"brief {i}: platform must be linkedin, reddit, x or hn.") from None
                angle = str(b.get("angle") or "").strip()
                if len(angle) < 10:
                    raise ValueError(f"brief {i}: write the angle (what the post says).")
                story = str(b.get("story_id") or "") or None
                if story is not None and story not in stories:
                    raise ValueError(f"brief {i}: story_id isn't one of the founder's stories.")
                rows.append(
                    {
                        "day": max(1, min(int(b.get("day") or i), 30)),
                        "platform": platform,
                        "angle": angle[:2000],
                        "hook_formula": (str(b.get("hook") or "")[:16] or None),
                        "is_promotional": bool(b.get("is_promotional", False)),
                        "story_entry_id": uuid.UUID(story) if story else None,
                    }
                )
            latest = await scope.latest_run_for_project(project_id)
            run_id = latest.id if latest and latest.status in (RunStatus.SUCCEEDED, RunStatus.AWAITING_REVIEW) else None
            days = max(r["day"] for r in rows)
            plan = await scope.create_content_plan(
                project_id, run_id, days, client_name=client, status=RunStatus.SUCCEEDED
            )
            created = await scope.replace_briefs(plan.id, rows)
            await scope.record_usage(UsageKind.CONTENT_PLAN, plan_id=str(plan.id), via=client or "mcp")
            return {
                "plan_id": str(plan.id),
                "briefs": [
                    {"brief_id": str(b.id), "day": b.day, "platform": b.platform.value, "angle": b.angle[:200]}
                    for b in created
                ],
                "calendar_url": idea_link(project_id),
                "next": "Write each post and call save_draft(brief_id, text).",
            }

        return await as_founder(work, "write")

    @mcp.tool(title="List planned posts", annotations=READ_ONLY)
    async def list_briefs(idea_id: str) -> dict[str, Any]:
        """The idea's content plans with every brief and the state of its latest draft (none, needs work,
        passed the gates, approved)."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            project_id = _uuid(idea_id, "idea_id")
            plans = await scope.list_content_plans(project_id)
            out = []
            for plan in plans[:5]:
                drafts = {d.brief_id: d for d in await scope.latest_drafts(plan.id)}
                out.append(
                    {
                        "plan_id": str(plan.id),
                        "status": plan.status.value,
                        "via": plan.client_name,
                        "briefs": [
                            {
                                "brief_id": str(b.id),
                                "day": b.day,
                                "platform": b.platform.value,
                                "angle": b.angle[:300],
                                "promotional": b.is_promotional,
                                "draft": (
                                    {
                                        "version": drafts[b.id].version,
                                        "status": drafts[b.id].status.value,
                                        "text": drafts[b.id].text[:600],
                                    }
                                    if b.id in drafts
                                    else None
                                ),
                            }
                            for b in await scope.list_briefs(plan.id)
                        ],
                    }
                )
            return {"idea_id": idea_id, "plans": out, "calendar_url": idea_link(project_id)}

        return await as_founder(work)

    @mcp.tool(title="Save a post draft")
    async def save_draft(brief_id: str, text: str, first_comment: str | None = None) -> dict[str, Any]:
        """Save a post for a brief as a new draft version. Deno runs its gates (AI tells, invented numbers,
        community rules, the founder's voice) and a quality score. A draft that fails is saved as "needs work"
        with the exact lines to fix; fix them and save again. Never argue with the gates."""
        from deno_api.v1.content import _gate_context, _recent_quality_scores

        body = text.strip()
        if not 1 <= len(body) <= 6000:
            raise ValueError("A post is 1-6000 characters.")

        async def work(scope: UserScope, client: str | None) -> dict[str, Any]:
            brief = await scope.get_brief(_uuid(brief_id, "brief_id"))
            ctx, profile = await _gate_context(scope, brief)
            report = run_gates(body, ctx, profile=profile)
            layers = cast(list[dict[str, Any]], report.to_dict()["layers"])
            quality: dict[str, Any] | None = None
            if report.passed:
                user = await scope.ensure_profile()
                threshold = compute_adaptive_threshold(
                    await _recent_quality_scores(scope), user_threshold=user.quality_threshold
                )
                verdict = score_quality(
                    body, report, ctx, profile=profile, threshold=threshold, custom_weights=user.quality_weights
                )
                layers.append(verdict.to_gate_layer())
                quality = {"score": verdict.to_gate_layer().get("score"), "threshold": threshold}
            draft = await scope.add_draft(
                brief,
                text=body,
                first_comment=(first_comment or "").strip()[:2000] or None,
                status=DraftStatus.GATED if report.passed else DraftStatus.DRAFT,
                gate_layers=layers,
                client_name=client,
            )
            blocking = [
                {"rule": f["rule_id"], "message": f["message"], "quote": f["quote"], "fix": f["fix"]}
                for layer in layers
                for f in layer.get("findings", [])
                if isinstance(f, dict)
                and f.get("severity", "block") == "block"
                and not str(f.get("rule_id", "")).startswith("quality.")
            ]
            return {
                "draft_id": str(draft.id),
                "version": draft.version,
                "passed": report.passed,
                "status": "passed the gates" if report.passed else "needs work",
                "fix": blocking[:12],
                "quality": quality,
            }

        return await as_founder(work, "write")

    # ------------------------------------------------------------------ studio: know-how

    @mcp.tool(title="Read a Studio playbook", annotations=READ_ONLY)
    async def get_playbook(topic: str = "index") -> dict[str, Any]:
        """Deno Studio's written rules for making video and images that don't look AI-made. topic = one of the
        names listed by topic "index" (e.g. contract, preproduction, timing, motion, typography, style, sound,
        captions, voice, review, multi-agent, delivery, platforms, stills, hybrid), or a style name. Rules the
        founder turned off in their Rulebook are left out."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            if topic.strip().lower() in ("", "index", "list"):
                return {
                    "playbooks": [d.card() for d in list_docs("playbooks")],
                    "styles": [d.slug for d in list_docs("styles")],
                }
            doc = get_doc("playbooks", topic) or get_doc("styles", topic) or get_doc("skills", topic)
            if doc is None:
                names = ", ".join(d.slug for d in list_docs("playbooks"))
                raise ValueError(f"No playbook {topic!r}. Topics: {names}.")
            return {"name": doc.slug, "title": doc.title, "text": rulebook.apply(doc, await svc.struck_rules(scope))}

        return await as_founder(work)

    @mcp.tool(title="List Studio styles", annotations=READ_ONLY)
    async def list_styles(name: str | None = None) -> dict[str, Any]:
        """The named visual styles (rules, avoid-list, best for). Without a name: the list. With a name: that
        style's full guide. Pick one style per film; one name beats five adjectives."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            if name:
                doc = get_doc("styles", name)
                if doc is None:
                    raise ValueError(f"No style {name!r}. Styles: {', '.join(d.slug for d in list_docs('styles'))}.")
                return {
                    "name": doc.slug,
                    "title": doc.title,
                    **doc.meta,
                    "text": rulebook.apply(doc, await svc.struck_rules(scope)),
                }
            return {"styles": [d.card() for d in list_docs("styles")]}

        return await as_founder(work)

    @mcp.tool(title="Find a format recipe", annotations=READ_ONLY)
    async def search_recipes(query: str = "", ratio: str | None = None) -> dict[str, Any]:
        """Proven formats (15 s showreel, 30 s explainer, UI loop, changelog, carousel, …) with timing tables.
        query: what the founder wants ("launch reel for a dev tool"); ratio filters ("9:16", "16:9", "1:1", "4:5")."""

        async def work(_scope: UserScope, _client: str | None) -> dict[str, Any]:
            found = search_docs("recipes", query, limit=3, **({"ratio": ratio} if ratio else {}))
            if not found:
                return {"recipes": [], "all": [d.card() for d in list_docs("recipes")]}
            return {"recipes": [{**d.card(), "text": d.body} for d in found]}

        return await as_founder(work)

    @mcp.tool(title="Set the brand kit")
    async def set_brand_kit(
        idea_id: str,
        url: str | None = None,
        colors: dict[str, str] | None = None,
        fonts: dict[str, str] | None = None,
        logo_url: str | None = None,
    ) -> dict[str, Any]:
        """Read colours, fonts and logo from the product's website (url) and/or set them by hand: colors like
        {"background": "#FAF8F3", "ink": "#101613", "accent": "#C6F24E"}, fonts like {"display": "DM Serif
        Display", "body": "Inter", "mono": "JetBrains Mono"}. Stored on the idea; every video and image uses it."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            kit = await svc.set_brand_kit(
                scope, _uuid(idea_id, "idea_id"), url=url, colors=colors, fonts=fonts, logo_url=logo_url
            )
            return {"idea_id": idea_id, "brand_kit": kit}

        return await as_founder(work, "write")

    # ------------------------------------------------------------------ studio: media

    @mcp.tool(title="Search licensed media", annotations=READ_ONLY)
    async def search_media(
        kind: Literal["video", "image", "sfx", "music", "icon"],
        query: str,
        orientation: Literal["landscape", "portrait", "square"] | None = None,
        max_duration: float | None = None,
        limit: int = 8,
    ) -> dict[str, Any]:
        """Stock footage and photos (Pexels, Pixabay), CC0 sound effects and music loops (Freesound) and icons
        (Lucide, Tabler), each with its licence and credit. Download a result into the project with
        `studio fetch <id>` (it records the credit in CREDITS.json). Use real product screenshots for UI, never
        stock. Queries work best as 1-3 concrete nouns ("whoosh", "laptop desk night", "city timelapse")."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            await svc.hit_limit(
                redis(), f"media:{scope.user_id}", settings.media_searches_per_hour, 3600, "media searches"
            )
            return {}

        await as_founder(work)
        result = await media.search(
            kind,
            query,
            svc.media_keys(settings),
            limit=limit,
            orientation=orientation,
            max_duration=max_duration,
            cache=redis(),
        )
        return {
            "results": [i.public() for i in result.items],
            "notes": result.notes,
            "next": "Run `studio fetch <id>` in the project folder to download one with its credit.",
        }

    # ------------------------------------------------------------------ studio: saving + review

    @mcp.tool(title="Get an upload URL")
    async def create_upload(
        kind: Literal["review", "poster", "sheet", "page", "source", "captions"], ext: str, size: int
    ) -> dict[str, Any]:
        """A signed URL to PUT one file to Deno's storage (the studio kit does this for you with `studio
        upload`). Default to the light files only: poster (jpg, < 400 KB) and sheet (contact sheet jpg,
        < 600 KB); the MP4s stay on the founder's disk. Also: page (still pages), captions (vtt/srt), and only
        if the founder asks, review (720p mp4) or source (zip). Then pass the returned path to save_video."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            return await svc.create_upload(scope, settings, kind, ext, size)

        return await as_founder(work, "write")

    @mcp.tool(title="Save a video or image version")
    async def save_video(
        idea_id: str,
        manifest: dict[str, Any],
        files: dict[str, Any],
        item_id: str | None = None,
        brief_id: str | None = None,
        title: str | None = None,
        summary: str | None = None,
        final: bool = False,
    ) -> dict[str, Any]:
        """Save a rendered video or still to the founder's Deno Studio (usually done by `studio upload`).
        manifest = the project's film.json (optionally with external_url / stream_url: an unlisted video link
        the review page embeds, and sheet_index: the contact sheet's frame boxes). files = {"poster": path,
        "sheet": path, "captions": path, "pages": [paths]} from create_upload; "review" (an mp4) is optional
        and not needed. item_id = add a new version to an existing item.
        summary = what changed in this version. final=true refuses to save if an asset lacks a commercial
        licence or credit. Returns the review link and Deno's checks (reading time, words per screen, licences,
        copy gates)."""

        async def work(scope: UserScope, client: str | None) -> dict[str, Any]:
            out = await svc.save_version(
                scope,
                settings,
                project_id=_uuid(idea_id, "idea_id"),
                manifest=manifest,
                files=files,
                item_id=_uuid(item_id, "item_id") if item_id else None,
                brief_id=_uuid(brief_id, "brief_id") if brief_id else None,
                title=title,
                summary=summary,
                final=final,
                client_name=client,
            )
            return {**out, "review_url": studio_link(out["item_id"])}

        return await as_founder(work, "write")

    @mcp.tool(title="List Studio videos and images", annotations=READ_ONLY)
    async def list_studio(idea_id: str | None = None) -> dict[str, Any]:
        """The founder's saved videos and stills (newest first) with status and open-note counts."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            items = await scope.list_studio_items(_uuid(idea_id, "idea_id") if idea_id else None)
            out = []
            for it in items:
                notes = await scope.list_review_notes(it.id)
                out.append(
                    {
                        "item_id": str(it.id),
                        "idea_id": str(it.project_id),
                        "kind": it.kind.value,
                        "title": it.title,
                        "status": it.status.value,
                        "version": it.current_version,
                        "open_notes": sum(1 for n in notes if n.status.value == "open" and n.author == "founder"),
                        "review_url": studio_link(str(it.id)),
                    }
                )
            return {"items": out}

        return await as_founder(work)

    @mcp.tool(title="Read review notes", annotations=READ_ONLY)
    async def get_review_notes(item_id: str, include_closed: bool = False) -> dict[str, Any]:
        """The founder's notes on a video or still, each pinned to a version, frame and time (and optionally a
        range, an x/y spot or a page), with the clip and chapter that were on screen and quick tags. Notes by
        "system" are Deno's automated checks."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            out = await svc.notes_for_ai(scope, settings, _uuid(item_id, "item_id"), include_closed)
            return {**out, "review_url": studio_link(item_id)}

        return await as_founder(work)

    @mcp.tool(title="Answer a review note")
    async def reply_note(note_id: str, status: Literal["fixed", "wontfix", "open"], reply: str) -> dict[str, Any]:
        """Mark a note fixed (in the item's latest version) or won't fix, with a one-line reply the founder sees
        under their note."""

        async def work(scope: UserScope, _client: str | None) -> dict[str, Any]:
            return await svc.reply_note(scope, _uuid(note_id, "note_id"), status, reply)

        return await as_founder(work, "write")

    # ------------------------------------------------------------------ resources + prompts

    @mcp.resource("deno://playbooks/{topic}", name="playbook", mime_type="text/markdown")
    def playbook_resource(topic: str) -> str:
        """A Deno Studio playbook (default rules, without the founder's Rulebook changes)."""
        doc = get_doc("playbooks", topic) or get_doc("styles", topic)
        if doc is None:
            raise ValueError(f"No playbook {topic!r}.")
        return doc.body

    def _skill_prompt(skill: str, ask: str) -> str:
        doc = get_doc("skills", skill)
        body = doc.body if doc else ""
        return f"{ask}\n\nFollow this Deno Studio workflow:\n\n{body}"

    @mcp.prompt(title="Launch video")
    def launch_video(idea: str = "my latest idea", length_s: int = 20, ratio: str = "16:9") -> str:
        """Plan and make a launch film for a validated idea."""
        return _skill_prompt("video", f"Make a {length_s} s {ratio} launch video for {idea}.")

    @mcp.prompt(title="Vertical reel")
    def reel(topic: str = "the strongest pain my validation found", length_s: int = 15) -> str:
        """A 9:16 reel for Reels / Shorts / TikTok."""
        return _skill_prompt("video", f"Make a {length_s} s 9:16 reel about {topic}, with burned-in captions.")

    @mcp.prompt(title="Explainer with voiceover")
    def explainer(idea: str = "my latest idea", length_s: int = 30) -> str:
        """A narrated explainer: problem, what it is, three steps, proof, name."""
        voice = get_doc("skills", "voice")
        extra = f"\n\n{voice.body}" if voice else ""
        return _skill_prompt("video", f"Make a {length_s} s narrated explainer for {idea}.") + extra

    @mcp.prompt(title="LinkedIn carousel")
    def carousel(topic: str = "the pains my validation found", pages: int = 8) -> str:
        """An image carousel from the validated pains."""
        return _skill_prompt("stills", f"Make a {pages}-page LinkedIn carousel about {topic}.")

    @mcp.prompt(title="Content week")
    def content_week(idea: str = "my latest idea", platforms: str = "linkedin, x") -> str:
        """A week of posts, written in the founder's voice and saved through Deno's gates."""
        return _skill_prompt("posts", f"Plan and write a week of posts for {idea} on {platforms}.")

    # DNS-rebinding protection guards servers on localhost; this one is public, behind TLS and OAuth, and is
    # reached through several Vercel hostnames.
    asgi = mcp.streamable_http_app(
        streamable_http_path=MCP_PATH,
        stateless_http=True,
        json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    return mcp, asgi
