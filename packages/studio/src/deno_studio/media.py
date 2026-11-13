"""Licensed media search for the founder's AI (docs/18 §6).

Deno holds the provider keys; results come back in one shape with the licence and the credit, so the kit can
download a file and record where it came from. Providers:

- Pexels: stock video and photos (Pexels licence; credit appreciated; 200 req/h by default).
- Pixabay: stock video and photos (Pixabay licence; results must be cached 24 h; no permanent hotlinking, so the
  kit downloads files).
- Freesound: sound effects and music loops, **CC0 only** (filtered at the API).
- Iconify: Lucide (ISC) and Tabler (MIT) icons as SVG.

Every provider call is bounded (8 s) and a failing provider is skipped, never fatal: the search returns what the
others found plus a note.
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
from typing import Any, Literal, Protocol

import httpx

MediaKind = Literal["video", "image", "sfx", "music", "icon"]
Orientation = Literal["landscape", "portrait", "square"]
KINDS: tuple[MediaKind, ...] = ("video", "image", "sfx", "music", "icon")
CACHE_TTL_S = 24 * 3600  # Pixabay requires 24 h caching; it also spares everyone's rate limits
TIMEOUT = httpx.Timeout(8.0, connect=4.0)
CC0 = 'license:"Creative Commons 0"'


@dataclass(frozen=True)
class MediaItem:
    id: str
    kind: MediaKind
    title: str
    preview_url: str
    download_url: str
    source: str
    source_url: str
    license: str
    credit: str
    width: int | None = None
    height: int | None = None
    duration: float | None = None
    tags: list[str] = field(default_factory=list)
    ext: str = ""

    def public(self) -> dict[str, Any]:
        """What the model sees: everything except the raw download URL (the kit resolves it by id)."""
        return {k: v for k, v in asdict(self).items() if v not in (None, "", []) and k != "download_url"}


@dataclass(frozen=True)
class MediaKeys:
    pexels: str = ""
    pixabay: str = ""
    freesound: str = ""


class Cache(Protocol):
    async def get(self, key: str) -> Any: ...
    async def set(self, key: str, value: str, ex: int | None = None) -> Any: ...


@dataclass
class SearchResult:
    items: list[MediaItem]
    notes: list[str]


def _orient_pexels(o: Orientation | None) -> str | None:
    return o


def _pick_video_file(files: list[dict[str, Any]], want_portrait: bool) -> dict[str, Any] | None:
    """Prefer an HD (≤ 1920 on the long side) MP4 that matches the orientation."""
    mp4 = [f for f in files if str(f.get("file_type", "")).endswith("mp4") and f.get("link")]
    if not mp4:
        return None

    def score(f: dict[str, Any]) -> tuple[int, int]:
        w, h = int(f.get("width") or 0), int(f.get("height") or 0)
        long_side = max(w, h)
        fits = 1 if long_side <= 1920 else 0
        oriented = 1 if (h > w) == want_portrait else 0
        return (fits + oriented, long_side if fits else -long_side)

    return max(mp4, key=score)


# --------------------------------------------------------------------------- providers


async def _pexels(
    client: httpx.AsyncClient, key: str, kind: MediaKind, q: str, n: int, o: Orientation | None
) -> list[MediaItem]:
    headers = {"Authorization": key}
    params: dict[str, Any] = {"query": q, "per_page": n}
    if o:
        params["orientation"] = _orient_pexels(o)
    if kind == "video":
        res = await client.get("https://api.pexels.com/v1/videos/search", params=params, headers=headers)
        res.raise_for_status()
        return [i for v in res.json().get("videos", []) if (i := pexels_video(v, o == "portrait"))]
    res = await client.get("https://api.pexels.com/v1/search", params=params, headers=headers)
    res.raise_for_status()
    return [pexels_photo(p) for p in res.json().get("photos", [])]


def pexels_video(v: dict[str, Any], portrait: bool = False) -> MediaItem | None:
    best = _pick_video_file(list(v.get("video_files") or []), portrait)
    if best is None:
        return None
    user = v.get("user") or {}
    return MediaItem(
        id=f"pexels:v:{v['id']}",
        kind="video",
        title=str(v.get("url", "")).rstrip("/").rsplit("/", 1)[-1].replace("-", " ")[:120] or f"Pexels video {v['id']}",
        preview_url=str(v.get("image", "")),
        download_url=str(best["link"]),
        source="pexels",
        source_url=str(v.get("url", "")),
        license="pexels",
        credit=f"{user.get('name', 'Unknown')} on Pexels",
        width=int(best.get("width") or v.get("width") or 0) or None,
        height=int(best.get("height") or v.get("height") or 0) or None,
        duration=float(v["duration"]) if v.get("duration") is not None else None,
        ext="mp4",
    )


def pexels_photo(p: dict[str, Any]) -> MediaItem:
    src = p.get("src") or {}
    return MediaItem(
        id=f"pexels:i:{p['id']}",
        kind="image",
        title=str(p.get("alt") or f"Pexels photo {p['id']}")[:120],
        preview_url=str(src.get("medium") or src.get("small") or ""),
        download_url=str(src.get("large2x") or src.get("original") or src.get("large") or ""),
        source="pexels",
        source_url=str(p.get("url", "")),
        license="pexels",
        credit=f"{p.get('photographer', 'Unknown')} on Pexels",
        width=p.get("width"),
        height=p.get("height"),
        ext="jpg",
    )


async def _pixabay(
    client: httpx.AsyncClient, key: str, kind: MediaKind, q: str, n: int, o: Orientation | None
) -> list[MediaItem]:
    params: dict[str, Any] = {"key": key, "q": q[:100], "per_page": max(3, min(n, 200)), "safesearch": "true"}
    if kind == "video":
        res = await client.get("https://pixabay.com/api/videos/", params=params)
        res.raise_for_status()
        return [i for h in res.json().get("hits", []) if (i := pixabay_video(h))]
    params["image_type"] = "photo"
    if o in ("landscape", "portrait"):
        params["orientation"] = "horizontal" if o == "landscape" else "vertical"
    res = await client.get("https://pixabay.com/api/", params=params)
    res.raise_for_status()
    return [pixabay_photo(h) for h in res.json().get("hits", [])][:n]


def pixabay_video(h: dict[str, Any]) -> MediaItem | None:
    sizes = h.get("videos") or {}
    best = next((sizes[s] for s in ("large", "medium", "small") if (sizes.get(s) or {}).get("url")), None)
    if best is None:
        return None
    return MediaItem(
        id=f"pixabay:v:{h['id']}",
        kind="video",
        title=str(h.get("tags", ""))[:120] or f"Pixabay video {h['id']}",
        preview_url=str(best.get("thumbnail") or (sizes.get("tiny") or {}).get("thumbnail") or ""),
        download_url=str(best["url"]),
        source="pixabay",
        source_url=str(h.get("pageURL", "")),
        license="pixabay",
        credit=f"{h.get('user', 'Unknown')} on Pixabay",
        width=best.get("width"),
        height=best.get("height"),
        duration=float(h["duration"]) if h.get("duration") is not None else None,
        tags=[t.strip() for t in str(h.get("tags", "")).split(",") if t.strip()][:8],
        ext="mp4",
    )


def pixabay_photo(h: dict[str, Any]) -> MediaItem:
    return MediaItem(
        id=f"pixabay:i:{h['id']}",
        kind="image",
        title=str(h.get("tags", ""))[:120] or f"Pixabay image {h['id']}",
        preview_url=str(h.get("webformatURL") or h.get("previewURL") or ""),
        download_url=str(h.get("largeImageURL") or h.get("webformatURL") or ""),
        source="pixabay",
        source_url=str(h.get("pageURL", "")),
        license="pixabay",
        credit=f"{h.get('user', 'Unknown')} on Pixabay",
        width=h.get("imageWidth"),
        height=h.get("imageHeight"),
        tags=[t.strip() for t in str(h.get("tags", "")).split(",") if t.strip()][:8],
        ext="jpg",
    )


_FS_FIELDS = "id,name,duration,license,username,previews,url,tags"


async def _freesound(
    client: httpx.AsyncClient, key: str, kind: MediaKind, q: str, n: int, max_s: float | None
) -> list[MediaItem]:
    if kind == "music":
        filt = f"{CC0} duration:[20 TO {int(max_s or 300)}] (tag:music OR tag:loop OR tag:soundtrack)"
    else:
        filt = f"{CC0} duration:[0 TO {max(0.5, max_s or 10):g}]"
    params: dict[str, str | int] = {
        "query": q,
        "filter": filt,
        "fields": _FS_FIELDS,
        "page_size": n,
        "token": key,
        "sort": "score",
    }
    res = await client.get("https://freesound.org/apiv2/search/text/", params=params)
    res.raise_for_status()
    return [i for s in res.json().get("results", []) if (i := freesound_sound(s, kind))]


def freesound_sound(s: dict[str, Any], kind: MediaKind) -> MediaItem | None:
    lic = str(s.get("license", ""))
    if "publicdomain/zero" not in lic and "Creative Commons 0" not in lic:
        return None  # belt and braces: the API filter already asks for CC0
    previews = s.get("previews") or {}
    url = previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3")
    if not url:
        return None
    return MediaItem(
        id=f"freesound:{s['id']}",
        kind=kind,
        title=str(s.get("name", ""))[:120],
        preview_url=str(url),
        download_url=str(url),
        source="freesound",
        source_url=str(s.get("url", "")),
        license="cc0",
        credit=f"{s.get('username', 'Unknown')} on Freesound (CC0)",
        duration=float(s["duration"]) if s.get("duration") is not None else None,
        tags=[str(t) for t in (s.get("tags") or [])][:8],
        ext="mp3",
    )


_ICON_SETS = {"lucide": ("isc", "Lucide (ISC)"), "tabler": ("mit", "Tabler Icons (MIT)")}


async def _iconify(client: httpx.AsyncClient, q: str, n: int) -> list[MediaItem]:
    res = await client.get(
        "https://api.iconify.design/search", params={"query": q, "limit": max(32, n), "prefixes": ",".join(_ICON_SETS)}
    )
    res.raise_for_status()
    out: list[MediaItem] = []
    for name in res.json().get("icons", [])[:n]:
        prefix, _, icon = str(name).partition(":")
        if prefix not in _ICON_SETS or not icon:
            continue
        lic, credit = _ICON_SETS[prefix]
        url = f"https://api.iconify.design/{prefix}/{icon}.svg"
        out.append(
            MediaItem(
                id=f"icon:{prefix}:{icon}",
                kind="icon",
                title=icon.replace("-", " "),
                preview_url=url,
                download_url=url,
                source="iconify",
                source_url=f"https://icon-sets.iconify.design/{prefix}/{icon}/",
                license=lic,
                credit=credit,
                ext="svg",
            )
        )
    return out


# --------------------------------------------------------------------------- search + lookup


def _cache_key(*parts: object) -> str:
    return "media:" + hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:32]


def _item_key(item_id: str) -> str:
    return f"media:item:{item_id}"


async def _cached(cache: Cache | None, key: str, make: Callable[[], Awaitable[list[MediaItem]]]) -> list[MediaItem]:
    if cache is not None:
        try:
            raw = await cache.get(key)
        except Exception:  # a cache outage must not break search
            raw = None
        if raw:
            return [MediaItem(**d) for d in json.loads(raw)]
    items = await make()
    if cache is not None:
        try:
            await cache.set(key, json.dumps([asdict(i) for i in items]), ex=CACHE_TTL_S)
            for i in items:
                await cache.set(_item_key(i.id), json.dumps(asdict(i)), ex=CACHE_TTL_S)
        except Exception:  # noqa: S110 — best effort
            pass
    return items


async def search(
    kind: MediaKind,
    query: str,
    keys: MediaKeys,
    *,
    limit: int = 8,
    orientation: Orientation | None = None,
    max_duration: float | None = None,
    cache: Cache | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> SearchResult:
    q = " ".join(query.split())[:100]
    n = max(1, min(limit, 20))
    if not q:
        return SearchResult([], ["Give a search query."])
    calls: list[tuple[str, Callable[[httpx.AsyncClient], Awaitable[list[MediaItem]]]]] = []
    if kind in ("video", "image"):
        if keys.pexels:
            calls.append(("pexels", lambda c: _pexels(c, keys.pexels, kind, q, n, orientation)))
        if keys.pixabay:
            calls.append(("pixabay", lambda c: _pixabay(c, keys.pixabay, kind, q, n, orientation)))
    elif kind in ("sfx", "music"):
        if keys.freesound:
            calls.append(("freesound", lambda c: _freesound(c, keys.freesound, kind, q, n, max_duration)))
    elif kind == "icon":
        calls.append(("iconify", lambda c: _iconify(c, q, n)))
    notes: list[str] = []
    if not calls:
        notes.append(
            f"No {kind} provider is configured on this Deno server."
            + (" Use the kit's synthesized sounds (`studio mix`) instead." if kind in ("sfx", "music") else "")
        )
        return SearchResult([], notes)
    async with httpx.AsyncClient(timeout=TIMEOUT, transport=transport, follow_redirects=True) as client:

        async def run(name: str, fn: Callable[[httpx.AsyncClient], Awaitable[list[MediaItem]]]) -> list[MediaItem]:
            try:
                return await _cached(cache, _cache_key(name, kind, q, n, orientation, max_duration), lambda: fn(client))
            except (httpx.HTTPError, ValueError, KeyError) as exc:
                status = getattr(getattr(exc, "response", None), "status_code", None)
                notes.append(f"{name} is unavailable right now" + (f" ({status})" if status else "") + ".")
                return []

        batches = await asyncio.gather(*(run(name, fn) for name, fn in calls))
    # Interleave providers so one doesn't crowd out the other.
    items: list[MediaItem] = []
    for i in range(max((len(b) for b in batches), default=0)):
        items += [b[i] for b in batches if i < len(b)]
    if orientation == "square":
        items = [i for i in items if not (i.width and i.height) or 0.8 <= i.width / i.height <= 1.25] or items
    if max_duration and kind == "video":
        items = [i for i in items if i.duration is None or i.duration <= max_duration] or items
    return SearchResult(items[:n], notes)


async def lookup(
    item_id: str,
    keys: MediaKeys,
    *,
    cache: Cache | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> MediaItem | None:
    """Resolve an id from ``search`` (cache first, then the provider), including its download URL."""
    if cache is not None:
        try:
            raw = await cache.get(_item_key(item_id))
        except Exception:
            raw = None
        if raw:
            return MediaItem(**json.loads(raw))
    parts = item_id.split(":")
    async with httpx.AsyncClient(timeout=TIMEOUT, transport=transport, follow_redirects=True) as client:
        item: MediaItem | None = None
        try:
            if parts[0] == "pexels" and len(parts) == 3 and keys.pexels and parts[2].isdigit():
                h = {"Authorization": keys.pexels}
                if parts[1] == "v":
                    res = await client.get(f"https://api.pexels.com/v1/videos/videos/{parts[2]}", headers=h)
                    res.raise_for_status()
                    item = pexels_video(res.json())
                else:
                    res = await client.get(f"https://api.pexels.com/v1/photos/{parts[2]}", headers=h)
                    res.raise_for_status()
                    item = pexels_photo(res.json())
            elif parts[0] == "pixabay" and len(parts) == 3 and keys.pixabay and parts[2].isdigit():
                url = "https://pixabay.com/api/videos/" if parts[1] == "v" else "https://pixabay.com/api/"
                res = await client.get(url, params={"key": keys.pixabay, "id": parts[2]})
                res.raise_for_status()
                hits = res.json().get("hits", [])
                if hits:
                    item = pixabay_video(hits[0]) if parts[1] == "v" else pixabay_photo(hits[0])
            elif parts[0] == "freesound" and len(parts) == 2 and keys.freesound and parts[1].isdigit():
                res = await client.get(
                    f"https://freesound.org/apiv2/sounds/{parts[1]}/",
                    params={"token": keys.freesound, "fields": _FS_FIELDS},
                )
                res.raise_for_status()
                data = res.json()
                item = freesound_sound(data, "music" if float(data.get("duration") or 0) >= 20 else "sfx")
            elif parts[0] == "icon" and len(parts) == 3 and parts[1] in _ICON_SETS:
                lic, credit = _ICON_SETS[parts[1]]
                url = f"https://api.iconify.design/{parts[1]}/{parts[2]}.svg"
                item = MediaItem(item_id, "icon", parts[2], url, url, "iconify", url, lic, credit, ext="svg")
        except (httpx.HTTPError, ValueError, KeyError):
            return None
    if item is not None and cache is not None:
        with contextlib.suppress(Exception):
            await cache.set(_item_key(item.id), json.dumps(asdict(item)), ex=CACHE_TTL_S)
    return item
