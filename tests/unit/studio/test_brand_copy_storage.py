"""Brand kits from a website, video copy checks, storage paths and signed uploads (docs/18)."""

from __future__ import annotations

import uuid

import pytest
import respx

from deno_core.errors import InvalidInput
from deno_core.storage import Storage, new_path, owns
from deno_studio import brand
from deno_studio.copycheck import check_video_copy

PAGE = """<html><head><title>Acme | Ship faster</title><meta name="theme-color" content="#C6F24E">
<link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="https://cdn.other.com/x.css">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400" rel="stylesheet">
<meta property="og:image" content="/og.png"></head><body style="color:#101613"><main>Hi</main></body></html>"""
CSS = "body{background:#faf8f3;font-family:Inter,system-ui,sans-serif}h1{font-family:'DM Serif Display',serif}"


async def test_brand_kit_reads_page_and_same_site_css_only() -> None:
    fetched: list[str] = []

    async def fetch(url: str, accept: str, want: tuple[str, ...]) -> tuple[str, str]:
        fetched.append(url)
        return (url, PAGE) if url.endswith("acme.dev/") else (url, CSS)

    kit = await brand.from_website("https://acme.dev/", fetch=fetch)
    assert fetched == ["https://acme.dev/", "https://acme.dev/app.css"]  # never the third-party stylesheet
    assert kit.name == "Acme"
    assert kit.colors == {"background": "#faf8f3", "ink": "#101613", "accent": "#c6f24e"}
    assert kit.fonts["body"] == "Inter" and kit.fonts["display"] == "DM Serif Display"
    assert kit.logo_url == "https://acme.dev/og.png" and kit.notes  # og image fallback is flagged


def test_brand_merge_keeps_existing_values() -> None:
    merged = brand.merge(
        {"colors": {"accent": "#111111", "ink": "#000000"}, "logo_url": "a"},
        colors={"accent": "#222222"},
        logo_url=None,
    )
    assert merged == {"colors": {"accent": "#222222", "ink": "#000000"}, "logo_url": "a"}


def test_video_copy_blocks_invented_numbers_and_slop_but_allows_known_numbers() -> None:
    bad = check_video_copy("Cut review time by 73%\nA game-changing workflow", "on_screen")
    assert not bad["passed"]
    assert {f["rule_id"] for f in bad["findings"]} >= {"L1.unsourced_number", "L2.vocab"}
    ok = check_video_copy("Cut review time by 73%", "on_screen", allowed_numbers=frozenset({"73%", "73"}))
    assert ok["passed"], ok


def test_long_lines_warn() -> None:
    report = check_video_copy("one two three four five six seven eight nine", "on_screen")
    assert any(f["rule_id"] == "screen.words" and f["severity"] == "warn" for f in report["findings"])
    caps = check_video_copy("x" * 100, "captions")
    assert any(f["rule_id"] == "captions.length" for f in caps["findings"])


def test_storage_paths_are_scoped_to_the_user() -> None:
    me, other = uuid.uuid4(), uuid.uuid4()
    path = new_path(me, "MP4")
    assert path.startswith(f"{me}/uploads/") and path.endswith(".mp4")
    assert owns(me, path) and not owns(other, path)
    assert not owns(me, f"{me}/uploads/../../{other}/x.mp4")
    assert new_path(me, "jpeg").endswith(".jpg")
    with pytest.raises(InvalidInput):
        new_path(me, "exe")


@respx.mock
async def test_signed_upload_size_and_read_urls() -> None:
    base = "https://sb.example.co/storage/v1"
    store = Storage("https://sb.example.co", "secret", "studio")
    me = uuid.uuid4()
    path = new_path(me, "mp4")
    respx.post(f"{base}/object/upload/sign/studio/{path}").respond(
        json={"url": f"/object/upload/sign/studio/{path}?token=t"}
    )
    signed = await store.sign_upload(path)
    assert signed.url == f"{base}/object/upload/sign/studio/{path}?token=t" and signed.content_type == "video/mp4"
    folder, _, name = path.rpartition("/")
    respx.post(f"{base}/object/list/studio").respond(json=[{"name": name, "metadata": {"size": 1234}}])
    assert await store.size(path) == 1234
    respx.post(f"{base}/object/sign/studio").respond(
        json=[{"path": path, "signedURL": f"/object/sign/studio/{path}?token=r"}]
    )
    assert await store.signed_urls([path]) == {path: f"{base}/object/sign/studio/{path}?token=r"}
    assert folder.endswith("/uploads")
