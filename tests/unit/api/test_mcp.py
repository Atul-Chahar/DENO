"""MCP server (docs/16): OAuth discovery, the bearer challenge, and the tool list for a signed-in founder.
No database: tools that read data are covered by the integration suite."""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest

from deno_api import mcp_server
from deno_api.app import create_app
from deno_core.settings import Settings
from tests.helpers.tokens import ISSUER, make_verifier, user_token

API = "https://api.example.com"
INIT = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "1"}},
}
EXPECTED_TOOLS = {
    "list_ideas",
    "validate_idea",
    "get_validation",
    "get_report",
    "get_founder_context",
    "check_copy",
    "create_content_plan",
    "list_briefs",
    "save_draft",
    "get_playbook",
    "list_styles",
    "search_recipes",
    "set_brand_kit",
    "search_media",
    "create_upload",
    "save_video",
    "list_studio",
    "get_review_notes",
    "reply_note",
}
HEADERS = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}


@contextlib.asynccontextmanager
async def serve() -> AsyncIterator[httpx.AsyncClient]:
    """The app with its lifespan running, entered and left in the same task (AnyIO cancel scopes need that)."""
    settings = Settings(  # type: ignore[call-arg]
        _env_file=None, environment="test", supabase_url=ISSUER.removesuffix("/auth/v1"), api_url=API
    )
    app = create_app(settings)
    app.state.sessionmaker = None  # no DB: the 2FA check is skipped, tools aren't called
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url=API) as c:
            yield c


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    verifier = make_verifier()
    monkeypatch.setattr(mcp_server, "_build_verifier", lambda: verifier)


async def test_protected_resource_metadata_points_at_supabase() -> None:
    async with serve() as client:
        await _test_protected_resource_metadata_points_at_supabase(client)


async def _test_protected_resource_metadata_points_at_supabase(client: httpx.AsyncClient) -> None:
    res = await client.get("/.well-known/oauth-protected-resource/mcp")
    assert res.status_code == 200
    meta: dict[str, Any] = res.json()
    assert meta["resource"] == f"{API}/mcp"
    assert meta["authorization_servers"] == [ISSUER]


async def test_unauthenticated_calls_get_the_oauth_challenge() -> None:
    async with serve() as client:
        await _test_unauthenticated_calls_get_the_oauth_challenge(client)


async def _test_unauthenticated_calls_get_the_oauth_challenge(client: httpx.AsyncClient) -> None:
    res = await client.post("/mcp", json=INIT, headers=HEADERS)
    assert res.status_code == 401
    challenge = res.headers["WWW-Authenticate"]
    assert challenge.startswith("Bearer") and "/.well-known/oauth-protected-resource/mcp" in challenge


async def test_a_signed_in_founder_sees_the_tools() -> None:
    async with serve() as client:
        await _test_a_signed_in_founder_sees_the_tools(client)


async def _test_a_signed_in_founder_sees_the_tools(client: httpx.AsyncClient) -> None:
    _user, auth = user_token()
    init = await client.post("/mcp", json=INIT, headers={**HEADERS, **auth})
    assert init.status_code == 200, init.text
    listed = await client.post(
        "/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, headers={**HEADERS, **auth}
    )
    assert listed.status_code == 200, listed.text
    tools = listed.json()["result"]["tools"]
    names = {t["name"] for t in tools}
    assert names == EXPECTED_TOOLS
    assert len(tools) <= 22, "keep the tool list short; models pick worse past ~25"
    read_only = {t["name"] for t in tools if (t.get("annotations") or {}).get("readOnlyHint")}
    assert {"list_ideas", "get_playbook", "search_media", "get_review_notes"} <= read_only
    assert not read_only & {"validate_idea", "save_draft", "save_video", "create_content_plan", "reply_note"}

    prompts = await client.post(
        "/mcp", json={"jsonrpc": "2.0", "id": 3, "method": "prompts/list"}, headers={**HEADERS, **auth}
    )
    assert {p["name"] for p in prompts.json()["result"]["prompts"]} == {
        "launch_video",
        "reel",
        "explainer",
        "carousel",
        "content_week",
    }
    templates = await client.post(
        "/mcp", json={"jsonrpc": "2.0", "id": 4, "method": "resources/templates/list"}, headers={**HEADERS, **auth}
    )
    assert [t["uriTemplate"] for t in templates.json()["result"]["resourceTemplates"]] == ["deno://playbooks/{topic}"]


async def test_api_routes_still_win_over_the_mount() -> None:
    async with serve() as client:
        await _test_api_routes_still_win_over_the_mount(client)


async def _test_api_routes_still_win_over_the_mount(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/v1/openapi.json")).status_code == 200
