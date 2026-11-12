"""Studio REST surface (docs/18): the review page on deno-web and the `studio` kit on the founder's machine.

The kit authenticates with the same Supabase OAuth server Claude uses (it registers itself as a client), so a
version uploaded by the kit is attributed to "Studio kit" or to the AI app that drove it.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

import jwt
from fastapi import APIRouter, Query, Request, Response, status
from pydantic import BaseModel, Field

from deno_api import studio_service as svc
from deno_api.deps import Scope
from deno_core.errors import InvalidInput, NotFound
from deno_core.settings import Settings, get_settings
from deno_studio import list_docs, media, rulebook

router = APIRouter(prefix="/studio", tags=["studio"])
brand_router = APIRouter(tags=["studio"])


def _settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", None) or get_settings()


async def _client(request: Request) -> str | None:
    """The OAuth client behind this (already verified) bearer token, as a readable label."""
    _, _, token = request.headers.get("Authorization", "").partition(" ")
    try:
        claims = jwt.decode(token.strip(), options={"verify_signature": False}) if token else {}
    except jwt.PyJWTError:
        return None
    client_id = claims.get("client_id")
    return await svc.client_label(_settings(request), getattr(request.app.state, "redis", None), client_id)


# ---- schemas ---------------------------------------------------------------------------------


class UploadIn(BaseModel):
    kind: Literal["review", "poster", "sheet", "page", "source", "captions"]
    ext: str = Field(min_length=2, max_length=5)
    size: int = Field(gt=0)


class VersionIn(BaseModel):
    idea_id: uuid.UUID
    manifest: dict[str, Any]
    files: dict[str, Any]
    item_id: uuid.UUID | None = None
    brief_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=200)
    summary: str | None = Field(default=None, max_length=2000)
    final: bool = False


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    version: int | None = Field(default=None, ge=1)
    t: float | None = Field(default=None, ge=0)
    t_end: float | None = Field(default=None, ge=0)
    x: float | None = Field(default=None, ge=0, le=1)
    y: float | None = Field(default=None, ge=0, le=1)
    page: int | None = Field(default=None, ge=0, le=30)
    tags: list[str] = Field(default_factory=list, max_length=8)


class NotePatch(BaseModel):
    status: Literal["open", "fixed", "wontfix", "resolved"] | None = None
    reply: str | None = Field(default=None, max_length=1000)
    text: str | None = Field(default=None, min_length=1, max_length=4000)


class BrandIn(BaseModel):
    colors: dict[str, str] | None = None
    fonts: dict[str, str] | None = None
    logo_url: str | None = Field(default=None, max_length=1000)
    rules: list[Annotated[str, Field(max_length=300)]] | None = Field(default=None, max_length=20)


class BrandImportIn(BaseModel):
    url: str = Field(min_length=4, max_length=500)


class RulebookIn(BaseModel):
    struck: list[Annotated[str, Field(max_length=80)]] = Field(default_factory=list, max_length=300)


# ---- items -------------------------------------------------------------------------------------


@router.get("/items")
async def list_items(scope: Scope, request: Request, project_id: uuid.UUID | None = None) -> list[dict[str, Any]]:
    settings = _settings(request)
    items = await scope.list_studio_items(project_id)
    out = []
    storage = svc.storage_for(settings)
    for it in items:
        posters: dict[str, str] = {}
        ver = await scope.get_studio_version(it.id) if it.current_version else None
        poster_path = None
        if ver is not None:
            poster_path = ver.files.get("poster") or (ver.files.get("pages") or [None])[0]
            if isinstance(poster_path, str) and storage.configured:
                posters = await storage.signed_urls([poster_path])
        notes = await scope.list_review_notes(it.id)
        out.append(
            {
                "id": str(it.id),
                "idea_id": str(it.project_id),
                "kind": it.kind.value,
                "title": it.title,
                "status": it.status.value,
                "client_name": it.client_name,
                "current_version": it.current_version,
                "updated_at": it.updated_at.isoformat(),
                "duration": ver.duration if ver else None,
                "poster_url": posters.get(poster_path) if isinstance(poster_path, str) else None,
                "open_notes": sum(1 for n in notes if n.status.value == "open" and n.author == "founder"),
            }
        )
    return out


@router.get("/items/{item_id}")
async def get_item(item_id: uuid.UUID, scope: Scope, request: Request) -> dict[str, Any]:
    return await svc.item_view(scope, _settings(request), await scope.get_studio_item(item_id))


@router.post("/items/{item_id}/approve")
async def approve_item(item_id: uuid.UUID, scope: Scope, request: Request) -> dict[str, Any]:
    item = await svc.approve(scope, item_id)
    return await svc.item_view(scope, _settings(request), item, with_notes=False)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: uuid.UUID, scope: Scope, request: Request) -> Response:
    paths = await scope.delete_studio_item(item_id)
    storage = svc.storage_for(_settings(request))
    if storage.configured:
        await storage.remove(paths)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- kit: uploads + versions -----------------------------------------------------------------


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def create_upload(body: UploadIn, scope: Scope, request: Request) -> dict[str, Any]:
    return await svc.create_upload(scope, _settings(request), body.kind, body.ext, body.size)


@router.post("/versions", status_code=status.HTTP_201_CREATED)
async def save_version(body: VersionIn, scope: Scope, request: Request) -> dict[str, Any]:
    settings = _settings(request)
    out = await svc.save_version(
        scope,
        settings,
        project_id=body.idea_id,
        manifest=body.manifest,
        files=body.files,
        item_id=body.item_id,
        brief_id=body.brief_id,
        title=body.title,
        summary=body.summary,
        final=body.final,
        client_name=await _client(request) or "Studio kit",
    )
    return {**out, "review_url": f"{settings.app_url.rstrip('/')}/app/studio/{out['item_id']}"}


# ---- notes -------------------------------------------------------------------------------------


@router.get("/items/{item_id}/notes")
async def list_notes(item_id: uuid.UUID, scope: Scope, request: Request, open_only: bool = False) -> dict[str, Any]:
    return await svc.notes_for_ai(scope, _settings(request), item_id, include_closed=not open_only)


@router.post("/items/{item_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_note(item_id: uuid.UUID, body: NoteIn, scope: Scope) -> dict[str, Any]:
    return await svc.add_note(scope, item_id, **body.model_dump())


@router.patch("/notes/{note_id}")
async def edit_note(note_id: uuid.UUID, body: NotePatch, scope: Scope) -> dict[str, Any]:
    note = await scope.get_review_note(note_id)
    if body.text is not None:
        if note.author != "founder":
            raise InvalidInput("Automated check notes can't be edited; resolve them instead.")
        note.text = body.text.strip()
    if body.status is not None or body.reply is not None:
        return await svc.reply_note(scope, note_id, body.status or note.status.value, body.reply)
    return svc.note_view(note)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: uuid.UUID, scope: Scope) -> Response:
    await scope.delete_review_note(note_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- media -------------------------------------------------------------------------------------


@router.get("/media/search")
async def search_media(
    scope: Scope,
    request: Request,
    kind: Literal["video", "image", "sfx", "music", "icon"],
    q: Annotated[str, Query(min_length=1, max_length=100)],
    orientation: Literal["landscape", "portrait", "square"] | None = None,
    max_duration: Annotated[float | None, Query(gt=0, le=600)] = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
) -> dict[str, Any]:
    settings = _settings(request)
    redis = getattr(request.app.state, "redis", None)
    await svc.hit_limit(redis, f"media:{scope.user_id}", settings.media_searches_per_hour, 3600, "media searches")
    result = await media.search(
        kind, q, svc.media_keys(settings), limit=limit, orientation=orientation, max_duration=max_duration, cache=redis
    )
    return {"results": [i.public() for i in result.items], "notes": result.notes}


@router.get("/media/item")
async def media_item(
    scope: Scope, request: Request, id: Annotated[str, Query(min_length=3, max_length=200)]
) -> dict[str, Any]:
    """One search result with its download URL (the kit's `studio fetch`)."""
    settings = _settings(request)
    item = await media.lookup(id, svc.media_keys(settings), cache=getattr(request.app.state, "redis", None))
    if item is None:
        raise NotFound()
    return {**item.public(), "download_url": item.download_url}


# ---- rulebook + taste ----------------------------------------------------------------------------


@router.get("/rulebook")
async def get_rulebook(scope: Scope) -> dict[str, Any]:
    struck = await svc.struck_rules(scope)
    titles = {d.slug: d.title for kind in ("playbooks", "styles") for d in list_docs(kind)}
    return {
        "rules": [
            {
                "id": r.id,
                "doc": r.doc,
                "doc_title": titles.get(r.doc, r.doc),
                "kind": r.kind,
                "text": r.text,
                "core": r.core,
                "struck": r.id in struck,
            }
            for r in rulebook.all_rules()
        ],
        "taste": await svc.taste(scope),
    }


@router.put("/rulebook")
async def put_rulebook(body: RulebookIn, scope: Scope) -> dict[str, Any]:
    return {"struck": await svc.set_struck_rules(scope, body.struck)}


# ---- brand kit -----------------------------------------------------------------------------------


@brand_router.get("/projects/{project_id}/brand")
async def get_brand(project_id: uuid.UUID, scope: Scope) -> dict[str, Any]:
    row = await scope.get_brand_kit(project_id)
    return {
        "project_id": str(project_id),
        "brand_kit": row.data if row else None,
        "source_url": row.source_url if row else None,
    }


@brand_router.put("/projects/{project_id}/brand")
async def put_brand(project_id: uuid.UUID, body: BrandIn, scope: Scope) -> dict[str, Any]:
    kit = await svc.set_brand_kit(
        scope, project_id, colors=body.colors, fonts=body.fonts, logo_url=body.logo_url, rules=body.rules
    )
    return {"project_id": str(project_id), "brand_kit": kit}


@brand_router.post("/projects/{project_id}/brand/import")
async def import_brand(project_id: uuid.UUID, body: BrandImportIn, scope: Scope) -> dict[str, Any]:
    kit = await svc.set_brand_kit(scope, project_id, url=body.url)
    return {"project_id": str(project_id), "brand_kit": kit}
