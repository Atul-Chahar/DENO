"""Studio logic shared by the MCP tools, the kit's REST calls and the web app (docs/18).

Everything here works on a ``UserScope`` (one founder, one transaction), so the MCP, the `studio` CLI and the
review page behave the same way and write the same rows.
"""

from __future__ import annotations

import contextlib
import uuid
from collections import Counter
from datetime import UTC, datetime
from typing import Any

import httpx
from pydantic import ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError

from deno_core.db import models as m
from deno_core.db.enums import NoteStatus, Plan, StudioKind, StudioStatus
from deno_core.db.repositories import UserScope
from deno_core.errors import Conflict, InvalidInput, NotFound, QuotaExceeded, RateLimited
from deno_core.logging import get_logger
from deno_core.ratelimit import SlidingWindowLimiter
from deno_core.settings import Settings
from deno_core.storage import Storage, new_path, owns
from deno_gates import VoiceProfile, number_words_in, numbers_in
from deno_sources.website import SiteUnavailable
from deno_studio import brand as brand_mod
from deno_studio import licences, media, rulebook
from deno_studio.copycheck import CopyKind, check_video_copy
from deno_studio.manifest import (
    FilmManifest,
    asset_findings,
    pending_findings,
    review_findings,
    timing_findings,
)

log = get_logger(__name__)

FILE_ROLES = ("review", "poster", "sheet", "source", "captions", "pages")
UPLOAD_KINDS = {
    "review": ("mp4",),
    "poster": ("png", "jpg", "webp"),
    "sheet": ("png", "jpg", "webp"),
    "page": ("png", "jpg", "webp", "pdf"),
    "source": ("zip",),
    "captions": ("vtt", "srt"),
}
# Dashboard files stay tiny (docs/18): a 50 MB review copy per version would fill Supabase's free 1 GB after
# ~20 videos, while poster + sheet + manifest is ~250 KB (4,000+ projects). The MP4s stay on the founder's disk.
LIGHT_MAX_BYTES = {"poster": 400 * 1024, "sheet": 600 * 1024, "captions": 200 * 1024}
QUICK_TAGS = ("pacing", "text", "motion", "sound", "brand", "lost-interest", "facts", "composition")


# --------------------------------------------------------------------------- helpers


def storage_for(settings: Settings) -> Storage:
    return Storage(settings.supabase_url, settings.supabase_secret_key.get_secret_value(), settings.studio_bucket)


def media_keys(settings: Settings) -> media.MediaKeys:
    return media.MediaKeys(
        pexels=settings.pexels_api_key.get_secret_value(),
        pixabay=settings.pixabay_api_key.get_secret_value(),
        freesound=settings.freesound_api_key.get_secret_value(),
    )


async def hit_limit(redis: Redis | None, key: str, limit: int, window_s: int, what: str) -> None:
    """Sliding-window limit; fails open when Valkey is down (same policy as the API)."""
    if redis is None:
        return
    try:
        decision = await SlidingWindowLimiter(redis).hit(key, limit, window_s)
    except RedisError:
        log.warning("rate_limiter_unavailable", key=key.split(":")[0])
        return
    if not decision.allowed:
        raise RateLimited(f"Too many {what}. Try again in {decision.retry_after_s} s.")


async def client_label(settings: Settings, redis: Redis | None, client_id: str | None) -> str | None:
    """A readable name for the OAuth client ("Claude", "ChatGPT", "Studio kit"); None for the web app's own
    session. Looked up once a day from Supabase's OAuth client registry."""
    if not client_id or client_id == "supabase-session":
        return None
    key = f"oauthclient:{client_id}"
    if redis is not None:
        try:
            cached = await redis.get(key)
            if cached:
                return cached.decode() if isinstance(cached, bytes) else str(cached)
        except RedisError:
            pass
    name = "AI app"
    secret = settings.supabase_secret_key.get_secret_value()
    if settings.supabase_url and secret:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                res = await c.get(
                    f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/oauth/clients/{client_id}",
                    headers={"apikey": secret, "Authorization": f"Bearer {secret}"},
                )
            if res.status_code == 200:
                raw = str(res.json().get("client_name") or "").strip()
                name = _short_client(raw) or name
        except httpx.HTTPError:
            pass
    if redis is not None:
        with contextlib.suppress(RedisError):
            await redis.set(key, name, ex=86400)
    return name


def _short_client(raw: str) -> str:
    low = raw.lower()
    for needle, label in (
        ("claude code", "Claude Code"),
        ("claude", "Claude"),
        ("chatgpt", "ChatGPT"),
        ("openai", "ChatGPT"),
        ("studio", "Studio kit"),
        ("cursor", "Cursor"),
    ):
        if needle in low:
            return label
    return raw[:40]


async def _plan(scope: UserScope) -> Plan:
    profile = await scope.ensure_profile()
    return profile.plan or Plan.FREE


async def _month_quota(scope: UserScope, settings: Settings) -> None:
    plan = await _plan(scope)
    if plan == Plan.INTERNAL:
        return
    limit = settings.studio_versions_per_month_pro if plan == Plan.PRO else settings.studio_versions_per_month_free
    month = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if await scope.count_studio_versions_since(month) >= limit:
        raise QuotaExceeded(f"Your plan includes {limit} saved studio versions a month.")


async def allowed_numbers(scope: UserScope, project_id: uuid.UUID | None) -> tuple[frozenset[str], frozenset[str]]:
    """Numbers the founder can stand behind: their Story Bank and their validation's evidenced claims."""
    text = " ".join(f"{s.headline} {s.details} {' '.join(map(str, s.numbers))}" for s in await scope.list_stories())
    if project_id is not None:
        run = await scope.latest_run_for_project(project_id)
        if run is not None:
            for claim, cites in await scope.list_claims_with_evidence(run.id):
                if not claim.flagged_wrong:
                    text += " " + claim.text + " " + " ".join(chunk.text for _c, chunk, _d in cites)
    return frozenset(numbers_in(text)), frozenset(number_words_in(text))


# --------------------------------------------------------------------------- founder context (docs/12 R2)


async def founder_context(scope: UserScope, project_id: uuid.UUID, dashboard: str) -> dict[str, Any]:
    """Everything Deno knows for making this founder's content, in one place (web, MCP and kit use it)."""
    project = await scope.get_project(project_id)
    profile = await scope.ensure_profile()
    latest = (await scope.latest_runs([project.id])).get(project.id)
    ctx: dict[str, Any] = {
        "idea_id": str(project.id),
        "idea": project.idea,
        "product": {"name": profile.product_name, "url": profile.product_url},
        "dashboard_url": f"{dashboard}/app?project={project.id}",
    }
    if latest:
        run, verdict = latest
        ctx["verdict"] = verdict.verdict.value if verdict else None
        ctx["confidence"] = verdict.confidence if verdict else None
        claims = await scope.list_claims_with_evidence(run.id)
        ctx["evidence"] = [
            {
                "analyst": c.analyst,
                "claim": c.text,
                "sources": [doc.url for _cit, _chunk, doc in cites][:2],
                "quote": next((chunk.text[:240] for _cit, chunk, _doc in cites), None),
            }
            for c, cites in claims
            if c.analyst in ("pain", "icp", "demand", "willingness_to_pay") and not c.flagged_wrong
        ][:15]
    ctx["stories"] = [
        {
            "id": str(s.id),
            "category": s.category.value,
            "headline": s.headline,
            "details": s.details[:600],
            "numbers": s.numbers,
        }
        for s in (await scope.list_stories())[:20]
    ]
    voice_profile = await scope.latest_voice_profile()
    samples = await scope.list_voice_samples()
    ctx["voice"] = {
        "has_profile": voice_profile is not None,
        "samples": [s.text[:500] for s in samples[:3]],
        "note": "Write like these samples: their sentence length, their words. No AI-sounding phrases.",
    }
    kit = await scope.get_brand_kit(project.id)
    ctx["brand_kit"] = kit.data if kit else None
    if kit is None:
        ctx["brand_kit_hint"] = "No brand kit yet: call set_brand_kit with the product's website URL."
    ctx["taste"] = await taste(scope)
    return ctx


async def taste(scope: UserScope) -> dict[str, Any]:
    profile = await scope.ensure_profile()
    prefs = dict(profile.studio_prefs or {})
    notes = await scope.recent_review_notes(limit=12)
    return {
        "struck_rules": len(prefs.get("struck_rules", [])),
        "tag_counts": prefs.get("tags", {}),
        "recent_notes": [n.text[:200] for n in notes],
        "note": "Past review notes show what this founder cares about; avoid repeating what they had to fix.",
    }


# --------------------------------------------------------------------------- know-how


async def struck_rules(scope: UserScope) -> set[str]:
    profile = await scope.ensure_profile()
    return set((profile.studio_prefs or {}).get("struck_rules", []))


async def set_struck_rules(scope: UserScope, rule_ids: list[str]) -> list[str]:
    profile = await scope.ensure_profile()
    allowed = sorted(rulebook.strikeable(rule_ids))
    profile.studio_prefs = {**(profile.studio_prefs or {}), "struck_rules": allowed}
    return allowed


# --------------------------------------------------------------------------- copy


async def check_copy(scope: UserScope, text: str, kind: CopyKind, project_id: uuid.UUID | None) -> dict[str, Any]:
    if not text.strip():
        raise InvalidInput("Give the text to check.")
    nums, words = await allowed_numbers(scope, project_id)
    row = await scope.latest_voice_profile()
    profile = VoiceProfile.from_dict(row.delta_baseline) if row else None
    return check_video_copy(text[:20_000], kind, allowed_numbers=nums, allowed_number_words=words, profile=profile)


# --------------------------------------------------------------------------- brand kit


async def set_brand_kit(
    scope: UserScope,
    project_id: uuid.UUID,
    *,
    url: str | None = None,
    colors: dict[str, str] | None = None,
    fonts: dict[str, str] | None = None,
    logo_url: str | None = None,
    rules: list[str] | None = None,
) -> dict[str, Any]:
    await scope.get_project(project_id)
    existing = await scope.get_brand_kit(project_id)
    data: dict[str, Any] = dict(existing.data) if existing else {}
    if url:
        try:
            found = await brand_mod.from_website(url)
        except SiteUnavailable as exc:
            raise InvalidInput(f"Couldn't read the site: {exc.reason}.") from None
        data = brand_mod.merge(data, **found.as_dict())
    data = brand_mod.merge(data, colors=_clean_map(colors), fonts=_clean_map(fonts), logo_url=logo_url, rules=rules)
    row = await scope.save_brand_kit(project_id, data, url)
    return dict(row.data)


def _clean_map(values: dict[str, str] | None) -> dict[str, str] | None:
    if not values:
        return None
    return {str(k)[:32]: str(v)[:80] for k, v in list(values.items())[:12] if v}


# --------------------------------------------------------------------------- uploads + saving


async def create_upload(scope: UserScope, settings: Settings, role: str, ext: str, size: int) -> dict[str, Any]:
    if role not in UPLOAD_KINDS:
        raise InvalidInput(f"kind must be one of {', '.join(UPLOAD_KINDS)}.")
    ext = ext.lower().lstrip(".").replace("jpeg", "jpg")
    if ext not in UPLOAD_KINDS[role]:
        raise InvalidInput(f"A {role} file must be {' or '.join(UPLOAD_KINDS[role])}.")
    cap = max_bytes(settings, role)
    if size <= 0 or size > cap:
        if role in LIGHT_MAX_BYTES:
            raise InvalidInput(f"A {role} must be under {cap // 1024} KB: send a JPEG (the kit does this for you).")
        mb = cap // (1024 * 1024)
        raise InvalidInput(f"Files must be under {mb} MB. Keep the master on your disk.")
    storage = storage_for(settings)
    if not storage.configured:
        raise Conflict("File storage isn't configured on this Deno server.")
    signed = await storage.sign_upload(new_path(scope.user_id, ext))
    return {**signed.as_dict(), "role": role, "max_bytes": cap}


def max_bytes(settings: Settings, role: str) -> int:
    return min(LIGHT_MAX_BYTES.get(role, settings.studio_upload_max_bytes), settings.studio_upload_max_bytes)


def _parse_manifest(raw: dict[str, Any] | str) -> FilmManifest:
    try:
        return FilmManifest.model_validate_json(raw) if isinstance(raw, str) else FilmManifest.model_validate(raw)
    except ValidationError as exc:
        problems = "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()[:8])
        raise InvalidInput(f"film.json isn't valid: {problems}") from None


async def save_version(
    scope: UserScope,
    settings: Settings,
    *,
    project_id: uuid.UUID,
    manifest: dict[str, Any] | str,
    files: dict[str, Any],
    item_id: uuid.UUID | None = None,
    brief_id: uuid.UUID | None = None,
    title: str | None = None,
    summary: str | None = None,
    final: bool = False,
    client_name: str | None = None,
) -> dict[str, Any]:
    """Create the item (first save) or add a version, after checking files, licences, timing and copy."""
    film = _parse_manifest(manifest)
    await _month_quota(scope, settings)
    storage = storage_for(settings)
    clean_files: dict[str, Any] = {}
    for role, value in (files or {}).items():
        if role not in FILE_ROLES:
            raise InvalidInput(f"Unknown file role {role!r}; use {', '.join(FILE_ROLES)}.")
        paths = value if isinstance(value, list) else [value]
        if role != "pages" and len(paths) != 1:
            raise InvalidInput(f"{role} takes one file path.")
        for path in paths:
            if not isinstance(path, str) or not owns(scope.user_id, path):
                raise InvalidInput(f"{role}: use a path returned by create_upload.")
            if storage.configured:
                size = await storage.size(path)
                if size is None:
                    raise InvalidInput(
                        f"{role}: {path} hasn't been uploaded yet. PUT the file to its upload_url first."
                    )
                if size > max_bytes(settings, "page" if role == "pages" else role):
                    raise InvalidInput(f"{role}: the file is over the size limit.")
        clean_files[role] = paths if role == "pages" else paths[0]
    if film.kind == "still" and "pages" not in clean_files and "poster" not in clean_files:
        raise InvalidInput("A still needs its pages (role 'pages') or a poster.")

    findings = timing_findings(film) + asset_findings(film, final=final) + pending_findings(film, final=final)
    findings += review_findings(film, clean_files)
    copy = "\n".join(t for _k, t in film.copy_lines())
    if copy:
        report = await check_copy(scope, copy, "on_screen", project_id)
        findings += [
            {
                "rule_id": f["rule_id"],
                "severity": f["severity"],
                "t": None,
                "message": f["message"],
                "fix": f["fix"],
                "quote": f.get("quote"),
            }
            for f in report["findings"]
        ]
    if final and (blocking := [f for f in findings if f["severity"] == "block"]):
        lines = "; ".join(f["message"] for f in blocking[:5])
        raise Conflict(f"Not saved as final: {len(blocking)} blocking problem(s): {lines}")

    if item_id is None:
        item = await scope.create_studio_item(
            project_id,
            kind=StudioKind(film.kind),
            title=title or film.title,
            brief_id=brief_id,
            client_name=client_name,
        )
    else:
        item = await scope.get_studio_item(item_id)
        if item.project_id != project_id:
            raise InvalidInput("That item belongs to another idea.")
        if title:
            item.title = title[:200]
    assets = []
    for a in film.assets:
        lc = licences.check(a.license)
        assets.append(
            {
                "asset_id": a.id,
                "kind": a.kind,
                "source": a.source,
                "license": lc.licence,
                "credit": a.credit,
                "source_url": a.source_url,
                "commercial": lc.commercial,
            }
        )
    version = await scope.add_studio_version(
        item,
        manifest=film.model_dump(mode="json", by_alias=True),
        files=clean_files,
        checks=findings,
        assets=assets,
        summary=(summary or "")[:2000] or None,
        duration=film.duration or None,
        client_name=client_name,
    )
    # Timed findings become system notes on the scrubber, so the founder sees them before watching.
    for f in findings:
        if f.get("t") is not None:
            await scope.add_review_note(
                item,
                version=version.version,
                t=float(f["t"]),
                frame=round(float(f["t"]) * film.fps),
                text=f"{f['message']} → {f['fix']}",
                tags=["check", f["severity"]],
                author="system",
                **_strip_locate(film.locate(float(f["t"]))),
            )
    return {
        "item_id": str(item.id),
        "version": version.version,
        "kind": item.kind.value,
        "status": item.status.value,
        "checks": findings,
        "blocking": sum(1 for f in findings if f["severity"] == "block"),
        "credits": [a for a in assets if a["credit"]],
    }


def _strip_locate(loc: dict[str, str | None]) -> dict[str, str | None]:
    return {k: v for k, v in loc.items() if k in ("clip_id", "chapter_id")}


# --------------------------------------------------------------------------- reading items + notes


async def item_view(
    scope: UserScope, settings: Settings, item: m.StudioItem, *, with_notes: bool = True
) -> dict[str, Any]:
    versions = await scope.list_studio_versions(item.id)
    storage = storage_for(settings)
    paths: list[str] = []
    for v in versions[:5]:
        for value in v.files.values():
            paths += value if isinstance(value, list) else [value]
    signed = await storage.signed_urls(paths) if storage.configured else {}

    def files(v: m.StudioVersion) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for role, value in v.files.items():
            out[role] = [signed.get(p) for p in value] if isinstance(value, list) else signed.get(value)
        return out

    current = versions[0] if versions else None
    view: dict[str, Any] = {
        "id": str(item.id),
        "idea_id": str(item.project_id),
        "brief_id": str(item.brief_id) if item.brief_id else None,
        "kind": item.kind.value,
        "title": item.title,
        "status": item.status.value,
        "client_name": item.client_name,
        "current_version": item.current_version,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
        "versions": [
            {
                "version": v.version,
                "created_at": v.created_at.isoformat(),
                "summary": v.summary,
                "duration": v.duration,
                "client_name": v.client_name,
                "files": files(v) if v in versions[:5] else {},
                "checks": v.checks,
                "manifest": v.manifest if v is current else FilmManifest.model_validate(v.manifest).summary(),
            }
            for v in versions
        ],
    }
    if current is not None:
        view["credits"] = [
            {
                "asset_id": a.asset_id,
                "kind": a.kind,
                "license": a.license,
                "credit": a.credit,
                "source_url": a.source_url,
                "commercial": a.commercial,
            }
            for a in await scope.list_studio_assets(item.id, current.version)
        ]
    if with_notes:
        view["notes"] = [note_view(n) for n in await scope.list_review_notes(item.id)]
    return view


def note_view(n: m.ReviewNote) -> dict[str, Any]:
    return {
        "id": str(n.id),
        "version": n.version,
        "frame": n.frame,
        "t": n.t,
        "t_end": n.t_end,
        "x": n.x,
        "y": n.y,
        "page": n.page,
        "text": n.text,
        "tags": n.tags,
        "status": n.status.value,
        "reply": n.reply,
        "fixed_in": n.fixed_in,
        "clip_id": n.clip_id,
        "chapter_id": n.chapter_id,
        "author": n.author,
        "created_at": n.created_at.isoformat(),
    }


async def add_note(
    scope: UserScope,
    item_id: uuid.UUID,
    *,
    text: str,
    version: int | None = None,
    t: float | None = None,
    t_end: float | None = None,
    x: float | None = None,
    y: float | None = None,
    page: int | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    text = text.strip()
    if not text:
        raise InvalidInput("Write the note.")
    item = await scope.get_studio_item(item_id)
    ver = await scope.get_studio_version(item_id, version)
    film = FilmManifest.model_validate(ver.manifest)
    if t is not None and film.duration and not (0 <= t <= film.duration + 0.5):
        raise InvalidInput("That time is outside the video.")
    if t_end is not None and (t is None or t_end <= t):
        raise InvalidInput("A range note needs an end after its start.")
    for v in (x, y):
        if v is not None and not 0 <= v <= 1:
            raise InvalidInput("Pins use 0–1 coordinates of the frame.")
    clean_tags = sorted({tg for tg in (tags or []) if tg in QUICK_TAGS})
    loc = _strip_locate(film.locate(t)) if t is not None else {"clip_id": None, "chapter_id": None}
    note = await scope.add_review_note(
        item,
        version=ver.version,
        t=t,
        t_end=t_end,
        frame=round(t * film.fps) if t is not None else None,
        x=x,
        y=y,
        page=page,
        text=text[:4000],
        tags=clean_tags,
        author="founder",
        **loc,
    )
    if clean_tags:
        profile = await scope.ensure_profile()
        prefs = dict(profile.studio_prefs or {})
        counts = Counter(prefs.get("tags", {}))
        counts.update(clean_tags)
        prefs["tags"] = dict(counts)
        profile.studio_prefs = prefs
    return note_view(note)


async def notes_for_ai(
    scope: UserScope, settings: Settings, item_id: uuid.UUID, include_closed: bool
) -> dict[str, Any]:
    item = await scope.get_studio_item(item_id)
    statuses = None if include_closed else [NoteStatus.OPEN]
    notes = await scope.list_review_notes(item_id, statuses=statuses)
    current = await scope.get_studio_version(item_id) if item.current_version else None
    review_url: str | None = None
    sheet_url: str | None = None
    if current is not None:
        storage = storage_for(settings)
        wanted = [p for p in (current.files.get("review"), current.files.get("sheet")) if isinstance(p, str)]
        signed = await storage.signed_urls(wanted) if wanted and storage.configured else {}
        review = current.files.get("review")
        review_url = signed.get(review) if isinstance(review, str) else None
        review_url = review_url or FilmManifest.model_validate(current.manifest).playable_url()
        sheet = current.files.get("sheet")
        sheet_url = signed.get(sheet) if isinstance(sheet, str) else None
    return {
        "item_id": str(item.id),
        "title": item.title,
        "status": item.status.value,
        "current_version": item.current_version,
        "review_copy_url": review_url,
        "sheet_url": sheet_url,
        "notes": [note_view(n) for n in notes],
        "how": "Fix one note at a time; keep everything else exactly as it is. Upload a new version, then "
        "reply_note(note_id, 'fixed', '<one line>') or 'wontfix' with the reason. Notes by 'system' are automated checks.",
    }


async def reply_note(scope: UserScope, note_id: uuid.UUID, status: str, reply: str | None) -> dict[str, Any]:
    note = await scope.get_review_note(note_id)
    try:
        new = NoteStatus(status)
    except ValueError:
        raise InvalidInput("status must be open, fixed, wontfix or resolved.") from None
    item = await scope.get_studio_item(note.item_id)
    note.status = new
    if reply is not None:
        note.reply = reply.strip()[:1000] or None
    if new == NoteStatus.FIXED:
        note.fixed_in = item.current_version
    return note_view(note)


async def approve(scope: UserScope, item_id: uuid.UUID) -> m.StudioItem:
    item = await scope.get_studio_item(item_id)
    if not item.current_version:
        raise Conflict("Nothing to approve yet: no version was saved.")
    ver = await scope.get_studio_version(item_id)
    if any(c.get("severity") == "block" and c.get("rule_id", "").startswith("assets.") for c in ver.checks):
        raise Conflict("An asset in this version has no commercial licence or credit. Replace it, then approve.")
    item.status = StudioStatus.APPROVED
    item.approved_at = datetime.now(UTC)
    return item


async def get_item_or_404(scope: UserScope, item_id: str) -> m.StudioItem:
    try:
        return await scope.get_studio_item(uuid.UUID(item_id))
    except ValueError:
        raise NotFound() from None
