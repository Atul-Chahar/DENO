"""Licensed media search: provider parsing, CC0-only sounds, caching, failures and lookups (docs/18 §6)."""

from __future__ import annotations

import json
from typing import Any

import httpx
import respx

from deno_studio import media

KEYS = media.MediaKeys(pexels="pk", pixabay="xk", freesound="fk")

PEXELS_VIDEO = {
    "id": 11,
    "url": "https://www.pexels.com/video/city-at-night-11/",
    "image": "https://images.pexels.com/v11.jpg",
    "duration": 12,
    "user": {"name": "Ann"},
    "video_files": [
        {"file_type": "video/mp4", "width": 3840, "height": 2160, "link": "https://v/4k.mp4"},
        {"file_type": "video/mp4", "width": 1920, "height": 1080, "link": "https://v/hd.mp4"},
        {"file_type": "video/mp4", "width": 1080, "height": 1920, "link": "https://v/vert.mp4"},
    ],
}
PIXABAY_VIDEO = {
    "id": 22,
    "pageURL": "https://pixabay.com/videos/22",
    "tags": "city, night",
    "duration": 9,
    "user": "Bo",
    "videos": {
        "large": {"url": "", "width": 0},
        "medium": {"url": "https://p/m.mp4", "width": 1280, "height": 720, "thumbnail": "https://p/t.jpg"},
    },
}


class DictCache:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    async def get(self, key: str) -> Any:
        return self.data.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> Any:
        self.data[key] = value


@respx.mock
async def test_video_search_merges_providers_and_hides_download_urls() -> None:
    respx.get("https://api.pexels.com/v1/videos/search").respond(json={"videos": [PEXELS_VIDEO]})
    respx.get("https://pixabay.com/api/videos/").respond(json={"hits": [PIXABAY_VIDEO]})
    result = await media.search("video", "city night", KEYS, limit=5)
    assert [i.id for i in result.items] == ["pexels:v:11", "pixabay:v:22"]
    pex = result.items[0]
    assert pex.download_url == "https://v/hd.mp4"  # HD, landscape, not the 4K master
    assert pex.license == "pexels" and pex.credit == "Ann on Pexels"
    assert "download_url" not in pex.public()
    assert result.items[1].download_url == "https://p/m.mp4"


@respx.mock
async def test_portrait_prefers_vertical_files() -> None:
    respx.get("https://api.pexels.com/v1/videos/search").respond(json={"videos": [PEXELS_VIDEO]})
    respx.get("https://pixabay.com/api/videos/").respond(json={"hits": []})
    result = await media.search("video", "city", KEYS, orientation="portrait")
    assert result.items[0].download_url == "https://v/vert.mp4"


@respx.mock
async def test_sounds_are_cc0_only() -> None:
    route = respx.get("https://freesound.org/apiv2/search/text/").respond(
        json={
            "results": [
                {
                    "id": 1,
                    "name": "whoosh",
                    "duration": 1.2,
                    "license": "http://creativecommons.org/publicdomain/zero/1.0/",
                    "username": "u",
                    "previews": {"preview-hq-mp3": "https://f/1.mp3"},
                    "url": "https://freesound.org/s/1",
                    "tags": ["whoosh"],
                },
                {
                    "id": 2,
                    "name": "nc",
                    "duration": 1,
                    "license": "http://creativecommons.org/licenses/by-nc/4.0/",
                    "username": "u",
                    "previews": {"preview-hq-mp3": "https://f/2.mp3"},
                },
            ]
        }
    )
    result = await media.search("sfx", "whoosh", KEYS)
    assert [i.id for i in result.items] == ["freesound:1"]
    assert result.items[0].license == "cc0"
    assert 'license:"Creative Commons 0"' in route.calls[0].request.url.params["filter"]


@respx.mock
async def test_a_failing_provider_is_a_note_not_an_error() -> None:
    respx.get("https://api.pexels.com/v1/search").respond(status_code=429)
    respx.get("https://pixabay.com/api/").respond(
        json={
            "hits": [
                {
                    "id": 5,
                    "pageURL": "https://pixabay.com/5",
                    "tags": "desk",
                    "webformatURL": "https://p/w.jpg",
                    "largeImageURL": "https://p/l.jpg",
                    "user": "C",
                    "imageWidth": 10,
                    "imageHeight": 10,
                }
            ]
        }
    )
    result = await media.search("image", "desk", KEYS)
    assert [i.id for i in result.items] == ["pixabay:i:5"]
    assert result.notes == ["pexels is unavailable right now (429)."]


async def test_unconfigured_providers_explain_themselves() -> None:
    result = await media.search("sfx", "pop", media.MediaKeys())
    assert result.items == [] and "synthesized" in result.notes[0]


@respx.mock
async def test_results_are_cached_and_lookup_uses_the_cache() -> None:
    route = respx.get("https://api.pexels.com/v1/videos/search").respond(json={"videos": [PEXELS_VIDEO]})
    respx.get("https://pixabay.com/api/videos/").respond(json={"hits": []})
    cache = DictCache()
    await media.search("video", "city", KEYS, cache=cache)
    await media.search("video", "city", KEYS, cache=cache)
    assert route.call_count == 1
    item = await media.lookup("pexels:v:11", KEYS, cache=cache)
    assert item is not None and item.download_url == "https://v/hd.mp4"
    assert json.loads(cache.data["media:item:pexels:v:11"])["credit"] == "Ann on Pexels"


@respx.mock
async def test_lookup_falls_back_to_the_provider() -> None:
    respx.get("https://api.pexels.com/v1/videos/videos/11").respond(json=PEXELS_VIDEO)
    item = await media.lookup("pexels:v:11", KEYS)
    assert item is not None and item.id == "pexels:v:11"
    assert await media.lookup("pexels:v:../../etc", KEYS) is None
    assert await media.lookup("nope:1", KEYS) is None


@respx.mock
async def test_icons_come_from_permissive_sets() -> None:
    respx.get("https://api.iconify.design/search").respond(
        json={"icons": ["lucide:rocket", "mdi:rocket", "tabler:rocket"]}
    )
    result = await media.search("icon", "rocket", media.MediaKeys())
    assert [(i.id, i.license) for i in result.items] == [("icon:lucide:rocket", "isc"), ("icon:tabler:rocket", "mit")]


async def test_empty_query() -> None:
    assert (await media.search("video", "   ", KEYS)).notes == ["Give a search query."]


def test_pick_video_file_handles_missing_files() -> None:
    assert media.pexels_video({**PEXELS_VIDEO, "video_files": []}) is None
    assert isinstance(httpx.Timeout(1), httpx.Timeout)
