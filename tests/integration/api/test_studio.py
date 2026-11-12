"""Studio end to end against Postgres + Valkey (docs/18): versions, checks as system notes, founder notes mapped
to clips, replies, approval, licences, brand kit, Rulebook, tenancy."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession, async_sessionmaker

from deno_api import auth
from deno_api.app import create_app
from deno_core.settings import Settings
from deno_core.storage import new_path
from deno_studio import rulebook
from tests.helpers.tokens import make_verifier, user_token

VALKEY_URL = "redis://127.0.0.1:6379/15"


@pytest.fixture
async def redis() -> AsyncIterator[Redis]:
    client = Redis.from_url(VALKEY_URL)
    try:
        await client.ping()
    except Exception:
        pytest.skip("Valkey not reachable on 127.0.0.1:6379")
    yield client
    await client.flushdb()
    await client.aclose()


@pytest.fixture
def maker(connection: AsyncConnection) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=connection, expire_on_commit=False, join_transaction_mode="create_savepoint")


@pytest.fixture
async def client(maker: async_sessionmaker[AsyncSession], redis: Redis) -> AsyncIterator[httpx.AsyncClient]:
    settings = Settings(environment="test", database_url="", valkey_url=VALKEY_URL, api_rate_limit_per_minute=1000)
    app = create_app(settings)
    app.state.sessionmaker = maker
    app.state.redis = redis
    verifier = make_verifier()
    app.dependency_overrides[auth.get_verifier] = lambda: verifier
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c,
    ):
        yield c


def manifest(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "schema": "deno.film/1",
        "title": "Launch reel",
        "formats": [{"ratio": "9:16"}],
        "fps": 30,
        "duration": 10,
        "style": "living-ui",
        "chapters": [{"id": "ch1", "start": 0, "end": 10}],
        "clips": [
            {
                "id": "hook",
                "chapter": "ch1",
                "start": 0,
                "end": 3,
                "text": [{"t": 0.2, "end": 0.6, "text": "PRs wait for days and days"}],
            },
            {"id": "demo", "chapter": "ch1", "start": 3, "end": 10},
        ],
        "assets": [
            {"id": "pexels:v:1", "kind": "video", "source": "pexels", "license": "pexels", "credit": "Ann on Pexels"}
        ],
    }
    base.update(over)
    return base


async def idea(client: httpx.AsyncClient, headers: dict[str, str]) -> str:
    res = await client.post(
        "/api/v1/projects", json={"idea": "A code review bot that catches race conditions in Go."}, headers=headers
    )
    assert res.status_code == 201, res.text
    return str(res.json()["id"])


async def test_save_review_reply_and_approve(client: httpx.AsyncClient) -> None:
    user, headers = user_token()
    me = uuid.UUID(user)
    project = await idea(client, headers)
    review = new_path(me, "mp4")
    poster = new_path(me, "png")

    saved = await client.post(
        "/api/v1/studio/versions",
        json={
            "idea_id": project,
            "manifest": manifest(),
            "files": {"review": review, "poster": poster},
            "summary": "first cut",
        },
        headers=headers,
    )
    assert saved.status_code == 201, saved.text
    out = saved.json()
    item_id = out["item_id"]
    assert out["version"] == 1 and out["status"] == "in_review"
    assert out["review_url"].endswith(f"/app/studio/{item_id}")
    # The hook text is held 0.4 s: a timed finding, which becomes a system note on the scrubber.
    assert any(c["rule_id"] == "film.reading_time" for c in out["checks"])

    view = (await client.get(f"/api/v1/studio/items/{item_id}", headers=headers)).json()
    assert view["kind"] == "video" and view["versions"][0]["summary"] == "first cut"
    assert view["credits"] == [
        {
            "asset_id": "pexels:v:1",
            "kind": "video",
            "license": "pexels",
            "credit": "Ann on Pexels",
            "source_url": None,
            "commercial": True,
        }
    ]
    system = [n for n in view["notes"] if n["author"] == "system"]
    assert system and system[0]["clip_id"] == "hook" and system[0]["frame"] == 6

    note = await client.post(
        f"/api/v1/studio/items/{item_id}/notes",
        json={"text": "I lost interest here", "t": 5.0, "t_end": 7.5, "x": 0.4, "y": 0.6, "tags": ["pacing", "bogus"]},
        headers=headers,
    )
    assert note.status_code == 201, note.text
    n = note.json()
    assert (n["clip_id"], n["chapter_id"], n["frame"], n["tags"]) == ("demo", "ch1", 150, ["pacing"])
    bad = await client.post(f"/api/v1/studio/items/{item_id}/notes", json={"text": "x", "t": 99}, headers=headers)
    assert bad.status_code == 422

    # Second version, then the AI answers the note.
    v2 = await client.post(
        "/api/v1/studio/versions",
        json={
            "idea_id": project,
            "item_id": item_id,
            "manifest": manifest(
                clips=[
                    {"id": "hook", "start": 0, "end": 3, "text": [{"t": 0, "end": 2.5, "text": "PRs wait for days"}]}
                ]
            ),
            "files": {"review": new_path(me, "mp4")},
        },
        headers=headers,
    )
    assert v2.json()["version"] == 2
    replied = await client.patch(
        f"/api/v1/studio/notes/{n['id']}", json={"status": "fixed", "reply": "Cut 2 s from the demo."}, headers=headers
    )
    assert replied.json()["status"] == "fixed" and replied.json()["fixed_in"] == 2

    open_only = (await client.get(f"/api/v1/studio/items/{item_id}/notes?open_only=true", headers=headers)).json()
    assert all(x["status"] == "open" for x in open_only["notes"])

    approved = await client.post(f"/api/v1/studio/items/{item_id}/approve", headers=headers)
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    listed = (await client.get(f"/api/v1/studio/items?project_id={project}", headers=headers)).json()
    assert [(i["id"], i["status"], i["current_version"]) for i in listed] == [(item_id, "approved", 2)]

    # Another founder sees nothing.
    _, other = user_token()
    assert (await client.get(f"/api/v1/studio/items/{item_id}", headers=other)).status_code == 404
    assert (
        await client.patch(f"/api/v1/studio/notes/{n['id']}", json={"status": "open"}, headers=other)
    ).status_code == 404

    assert (await client.delete(f"/api/v1/studio/items/{item_id}", headers=headers)).status_code == 204
    assert (await client.get(f"/api/v1/studio/items/{item_id}", headers=headers)).status_code == 404


async def test_uploads_must_be_the_callers_and_finals_need_licences(client: httpx.AsyncClient) -> None:
    user, headers = user_token()
    project = await idea(client, headers)
    foreign = new_path(uuid.uuid4(), "mp4")
    res = await client.post(
        "/api/v1/studio/versions",
        json={"idea_id": project, "manifest": manifest(), "files": {"review": foreign}},
        headers=headers,
    )
    assert res.status_code == 422 and "create_upload" in res.json()["error"]["message"]
    no_review = await client.post(
        "/api/v1/studio/versions", json={"idea_id": project, "manifest": manifest(), "files": {}}, headers=headers
    )
    assert no_review.status_code == 422
    nc = manifest(
        clips=[{"id": "a", "start": 0, "end": 10}],
        assets=[{"id": "freesound:9", "kind": "sfx", "license": "cc-by-nc"}],
    )
    final = await client.post(
        "/api/v1/studio/versions",
        json={"idea_id": project, "manifest": nc, "files": {"review": new_path(uuid.UUID(user), "mp4")}, "final": True},
        headers=headers,
    )
    assert final.status_code == 409 and "non-commercial" in final.json()["error"]["message"]
    broken = await client.post(
        "/api/v1/studio/versions",
        json={
            "idea_id": project,
            "manifest": {"formats": [{"ratio": "7:3"}]},
            "files": {"review": new_path(uuid.UUID(user), "mp4")},
        },
        headers=headers,
    )
    assert broken.status_code == 422 and "film.json" in broken.json()["error"]["message"]
    # Storage isn't configured in tests: asking for an upload URL says so instead of failing.
    up = await client.post(
        "/api/v1/studio/uploads", json={"kind": "review", "ext": "mp4", "size": 1000}, headers=headers
    )
    assert up.status_code == 409


async def test_stills_need_pages(client: httpx.AsyncClient) -> None:
    user, headers = user_token()
    me = uuid.UUID(user)
    project = await idea(client, headers)
    still = manifest(kind="still", pages=2, duration=0, clips=[], formats=[{"ratio": "4:5"}], assets=[])
    missing = await client.post(
        "/api/v1/studio/versions", json={"idea_id": project, "manifest": still, "files": {}}, headers=headers
    )
    assert missing.status_code == 422
    ok = await client.post(
        "/api/v1/studio/versions",
        json={"idea_id": project, "manifest": still, "files": {"pages": [new_path(me, "png"), new_path(me, "png")]}},
        headers=headers,
    )
    assert ok.status_code == 201 and ok.json()["kind"] == "still"


async def test_brand_kit_and_rulebook(client: httpx.AsyncClient) -> None:
    _, headers = user_token()
    project = await idea(client, headers)
    assert (await client.get(f"/api/v1/projects/{project}/brand", headers=headers)).json()["brand_kit"] is None
    put = await client.put(
        f"/api/v1/projects/{project}/brand",
        json={"colors": {"accent": "#C6F24E"}, "fonts": {"display": "DM Serif Display"}},
        headers=headers,
    )
    assert put.json()["brand_kit"]["colors"] == {"accent": "#C6F24E"}
    again = await client.put(f"/api/v1/projects/{project}/brand", json={"colors": {"ink": "#101613"}}, headers=headers)
    assert again.json()["brand_kit"]["colors"] == {"accent": "#C6F24E", "ink": "#101613"}

    book = (await client.get("/api/v1/studio/rulebook", headers=headers)).json()
    soft = next(r for r in book["rules"] if not r["core"])
    core = next(r for r in book["rules"] if r["core"])
    saved = await client.put(
        "/api/v1/studio/rulebook", json={"struck": [soft["id"], core["id"], "nope"]}, headers=headers
    )
    assert saved.json()["struck"] == [soft["id"]]
    book = (await client.get("/api/v1/studio/rulebook", headers=headers)).json()
    assert {r["id"] for r in book["rules"] if r["struck"]} == {soft["id"]}
    assert len(book["rules"]) == len(rulebook.all_rules())


async def test_media_without_keys_explains_itself(client: httpx.AsyncClient) -> None:
    _, headers = user_token()
    res = await client.get("/api/v1/studio/media/search?kind=sfx&q=whoosh", headers=headers)
    assert res.status_code == 200 and res.json()["results"] == [] and res.json()["notes"]
    assert (await client.get("/api/v1/studio/media/item?id=pexels:v:1", headers=headers)).status_code == 404
