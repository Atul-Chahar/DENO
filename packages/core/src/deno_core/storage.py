"""Supabase Storage for studio files (docs/18 §2): signed uploads straight from the founder's machine, signed
reads for the review page, deletes.

Files never pass through a Vercel function (4.5 MB body limit): the API signs an upload URL, the kit PUTs the file
to Storage, and the API then checks the object exists and records it. Paths are always
``<user_id>/uploads/<random>.<ext>`` and the API refuses any path outside the caller's prefix.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from deno_core.errors import InvalidInput, UpstreamUnavailable

EXTENSIONS = {
    "mp4": "video/mp4",
    "png": "image/png",
    "jpg": "image/jpeg",
    "webp": "image/webp",
    "pdf": "application/pdf",
    "zip": "application/zip",
    "json": "application/json",
    "vtt": "text/vtt",
    "srt": "application/x-subrip",
}
_SAFE_PATH = re.compile(r"^[0-9a-f-]{36}/[0-9a-z-]{1,40}/[0-9a-f]{32}\.[a-z0-9]{2,4}$")


@dataclass(frozen=True)
class SignedUpload:
    path: str
    url: str
    content_type: str
    expires_in: int = 7200

    def as_dict(self) -> dict[str, Any]:
        return {"path": self.path, "upload_url": self.url, "method": "PUT", "content_type": self.content_type}


def new_path(user_id: uuid.UUID, ext: str, folder: str = "uploads") -> str:
    ext = ext.lower().lstrip(".")
    if ext == "jpeg":
        ext = "jpg"
    if ext not in EXTENSIONS:
        raise InvalidInput(f"Can't store .{ext} files. Allowed: {', '.join(sorted(EXTENSIONS))}.")
    return f"{user_id}/{folder}/{uuid.uuid4().hex}.{ext}"


def owns(user_id: uuid.UUID, path: str) -> bool:
    return bool(_SAFE_PATH.match(path)) and path.startswith(f"{user_id}/")


class Storage:
    def __init__(
        self, supabase_url: str, secret_key: str, bucket: str, *, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self.base = f"{supabase_url.rstrip('/')}/storage/v1"
        self.bucket = bucket
        self._headers = {"apikey": secret_key, "Authorization": f"Bearer {secret_key}"}
        self._transport = transport

    @property
    def configured(self) -> bool:
        return bool(self._headers["apikey"]) and "://" in self.base

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=4.0), transport=self._transport)

    async def sign_upload(self, path: str) -> SignedUpload:
        ext = path.rsplit(".", 1)[-1]
        async with self._client() as c:
            try:
                res = await c.post(f"{self.base}/object/upload/sign/{self.bucket}/{path}", headers=self._headers)
            except httpx.HTTPError as exc:
                raise UpstreamUnavailable("File storage is unreachable. Try again.") from exc
        if res.status_code >= 400:
            raise UpstreamUnavailable(f"File storage refused the upload ({res.status_code}).")
        rel = str(res.json().get("url", ""))
        if not rel:
            raise UpstreamUnavailable("File storage didn't return an upload URL.")
        return SignedUpload(path=path, url=f"{self.base}{rel}", content_type=EXTENSIONS[ext])

    async def size(self, path: str) -> int | None:
        """The stored object's size in bytes, or None when it isn't there."""
        folder, _, name = path.rpartition("/")
        async with self._client() as c:
            try:
                res = await c.post(
                    f"{self.base}/object/list/{self.bucket}",
                    headers=self._headers,
                    json={"prefix": folder, "search": name, "limit": 1, "offset": 0},
                )
            except httpx.HTTPError as exc:
                raise UpstreamUnavailable("File storage is unreachable. Try again.") from exc
        if res.status_code >= 400:
            return None
        for obj in res.json() or []:
            if obj.get("name") == name:
                meta = obj.get("metadata") or {}
                return int(meta.get("size") or meta.get("contentLength") or 0)
        return None

    async def signed_urls(self, paths: list[str], expires_in: int = 3600) -> dict[str, str]:
        if not paths:
            return {}
        async with self._client() as c:
            try:
                res = await c.post(
                    f"{self.base}/object/sign/{self.bucket}",
                    headers=self._headers,
                    json={"expiresIn": expires_in, "paths": paths},
                )
            except httpx.HTTPError:
                return {}
        if res.status_code >= 400:
            return {}
        out: dict[str, str] = {}
        for row in res.json() or []:
            signed = row.get("signedURL") or row.get("signedUrl")
            if row.get("path") and signed:
                out[str(row["path"])] = f"{self.base}{signed}"
        return out

    async def remove(self, paths: list[str]) -> None:
        if not paths:
            return
        async with self._client() as c:
            try:
                await c.request(
                    "DELETE", f"{self.base}/object/{self.bucket}", headers=self._headers, json={"prefixes": paths}
                )
            except httpx.HTTPError:
                return
