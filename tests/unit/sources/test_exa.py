"""Exa as the keyless web-search backend: LinkedIn posts, and X through mirror URLs."""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from deno_sources import AccessDenied, SourceConfig, SourceName, SourceUnavailable, build_clients, build_fetcher
from deno_sources.base import EXA_MCP_URL, ExaSearchClient
from deno_sources.linkedin import parse_exa_post
from deno_sources.registry import build_web_search

FIX = Path(__file__).resolve().parents[2] / "fixtures" / "sources"


def jfixture(name: str) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIX / name).read_text())
    return data


def sse(result: dict[str, Any]) -> str:
    """Exa's hosted endpoint answers a JSON-RPC call as one server-sent event."""
    return f"event: message\ndata: {json.dumps({'jsonrpc': '2.0', 'id': 1, 'result': result})}\n\n"


def found(payload: dict[str, Any]) -> str:
    return sse({"content": [{"type": "text", "text": json.dumps(payload)}]})


async def public(_: str) -> list[str]:
    return ["93.184.216.34"]


async def no_sleep(_: float) -> None:
    return None


def setup(**config: Any) -> tuple[SourceConfig, Any]:
    cfg = SourceConfig(web_search_provider="exa", **config)
    return cfg, build_fetcher(cfg, resolver=public, transport=httpx.AsyncHTTPTransport(), sleep=no_sleep)


def sent(route: respx.Route, call: int = 0) -> dict[str, Any]:
    body: dict[str, Any] = json.loads(route.calls[call].request.content)
    args: dict[str, Any] = body["params"]["arguments"]
    return args


# ---- the search client ----------------------------------------------------------------


def test_exa_is_selected_without_a_key() -> None:
    cfg, fetcher = setup()
    assert isinstance(build_web_search(cfg, fetcher), ExaSearchClient)


@respx.mock
async def test_site_query_becomes_a_domain_filter() -> None:
    route = respx.post(EXA_MCP_URL).respond(200, text=found(jfixture("exa_linkedin.json")))
    _, fetcher = setup()
    results = await ExaSearchClient(fetcher).search('site:linkedin.com/posts "customer churn"', time_range="year")
    args = sent(route)
    assert args["includeDomains"] == ["linkedin.com/posts"]
    assert args["query"] == "customer churn"  # no site: operator, no quotes: Exa's search is semantic
    assert "startPublishedDate" in args
    assert results[0]["url"].startswith("https://www.linkedin.com/posts/samexample_")
    assert results[0]["title"].startswith("We lost 14 customers")
    assert "Usage dropped for three weeks" in results[0]["full_text"]
    assert results[0]["author"] == "Sam Example"
    assert results[0]["published"] == "2026-08-23T00:00:00.000Z"


@respx.mock
async def test_post_text_with_unicode_line_separators_still_parses() -> None:
    """Posts contain U+2028 and U+0085, which JSON leaves unescaped and ``str.splitlines`` splits on."""
    payload = {"results": [{"url": "https://www.linkedin.com/posts/a_b-activity-1-x", "text": "one\u2028two\x85three"}]}
    event = "event: message\ndata: " + json.dumps(
        {"result": {"content": [{"type": "text", "text": json.dumps(payload, ensure_ascii=False)}]}}, ensure_ascii=False
    )
    respx.post(EXA_MCP_URL).respond(200, text=event + "\n\n")
    _, fetcher = setup()
    results = await ExaSearchClient(fetcher).search("site:linkedin.com/posts churn")
    assert results[0]["full_text"] == "one\u2028two\x85three"


@respx.mock
async def test_x_is_searched_through_tweet_mirrors() -> None:
    """Exa has no x.com index, so a filter on x.com finds nothing; mirrors of tweets are indexed instead."""
    route = respx.post(EXA_MCP_URL).respond(200, text=found(jfixture("exa_x.json")))
    _, fetcher = setup()
    await ExaSearchClient(fetcher).search("site:x.com customer churn")
    args = sent(route)
    assert args["includeDomains"] and "x.com" not in args["includeDomains"]
    assert "customer churn" in args["query"]


@respx.mock
async def test_api_key_is_sent_when_configured() -> None:
    route = respx.post(EXA_MCP_URL).respond(200, text=found({"results": []}))
    cfg, fetcher = setup(web_search_api_key="exa-key")
    client = build_web_search(cfg, fetcher)
    assert await client.search("site:producthunt.com churn") == []
    assert route.calls[0].request.headers["x-api-key"] == "exa-key"


@respx.mock
@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(429),
        httpx.Response(500),
        httpx.Response(200, text=sse({"isError": True, "content": [{"type": "text", "text": "rate limit exceeded"}]})),
        httpx.Response(200, text='data: {"jsonrpc":"2.0","id":1,"error":{"code":-32602,"message":"bad"}}\n\n'),
        httpx.Response(200, text="<html>not what we asked for</html>"),
    ],
)
async def test_a_failing_search_is_unavailable_not_empty(response: httpx.Response) -> None:
    respx.post(EXA_MCP_URL).mock(return_value=response)
    _, fetcher = setup()
    with pytest.raises(SourceUnavailable):
        await ExaSearchClient(fetcher).search("site:linkedin.com/posts churn")


@respx.mock
async def test_an_error_answer_is_not_cached_but_a_real_one_is() -> None:
    limited = sse({"isError": True, "content": [{"type": "text", "text": "rate limit exceeded"}]})
    route = respx.post(EXA_MCP_URL).mock(
        side_effect=[httpx.Response(200, text=limited), httpx.Response(200, text=limited)]
        + [httpx.Response(200, text=found(jfixture("exa_linkedin.json"))) for _ in range(2)]
    )
    _, fetcher = setup()
    client = ExaSearchClient(fetcher)
    with pytest.raises(SourceUnavailable):
        await client.search("site:linkedin.com/posts churn")
    assert route.call_count == 2  # asked twice, never cached
    assert len(await client.search("site:linkedin.com/posts churn")) == 4
    assert len(await client.search("site:linkedin.com/posts churn")) == 4
    assert route.call_count == 3  # the last search came from the cache
    await client.search("site:linkedin.com/posts pricing")
    assert route.call_count == 4  # a different query is a different cache entry


@respx.mock
async def test_a_rate_limited_answer_is_retried_once() -> None:
    limited = sse({"isError": True, "content": [{"type": "text", "text": "rate limit exceeded"}]})
    route = respx.post(EXA_MCP_URL).mock(
        side_effect=[httpx.Response(200, text=limited), httpx.Response(200, text=found(jfixture("exa_linkedin.json")))]
    )
    _, fetcher = setup()
    assert len(await ExaSearchClient(fetcher).search("site:linkedin.com/posts churn")) == 4
    assert route.call_count == 2


@respx.mock
async def test_posting_respects_the_allow_list_and_daily_cap() -> None:
    respx.post(EXA_MCP_URL).respond(200, text=found({"results": []}))
    cfg, open_fetcher = setup()
    with pytest.raises(AccessDenied):
        await open_fetcher.post_json("https://evil.example.com/mcp", source="exa", payload={})
    cfg.daily_caps["exa"] = 1
    fetcher = build_fetcher(cfg, resolver=public, transport=httpx.AsyncHTTPTransport(), sleep=no_sleep)
    client = ExaSearchClient(fetcher)
    await client.search("site:linkedin.com/posts one")
    with pytest.raises(SourceUnavailable, match="daily cap"):
        await client.search("site:linkedin.com/posts two")


# ---- LinkedIn posts ---------------------------------------------------------------------


def test_parse_exa_post_keeps_the_post_and_drops_the_page_chrome() -> None:
    result = {
        "url": "https://www.linkedin.com/posts/samexample_churn-activity-7112009104717463552-2e3K",
        "title": "We lost 14 customers last quarter. | Sam Example",
        "author": "Sam Example",
        "published": "2026-08-23T00:00:00.000Z",
        "full_text": jfixture("exa_linkedin.json")["results"][0]["text"],
    }
    post = parse_exa_post(result)
    assert post is not None
    assert post.text.startswith("We lost 14 customers last quarter.")
    assert "Head of Customer Success" not in post.text  # the author's bio line is not the post
    assert "## Engagement" not in post.text and "Pat Reader" not in post.text
    assert post.author_handle == "samexample"
    assert post.published_at == datetime(2026, 8, 23, tzinfo=UTC)
    assert post.engagement.likes == 37 and post.engagement.comments == 5
    assert post.tier == "exa"
    assert parse_exa_post({"url": result["url"], "full_text": "# thin\n\n---\n\nSign in"}) is None


@respx.mock
async def test_linkedin_posts_are_read_from_the_search_result_without_fetching_linkedin() -> None:
    respx.post(EXA_MCP_URL).respond(200, text=found(jfixture("exa_linkedin.json")))
    linkedin = respx.get(url__startswith="https://www.linkedin.com/").respond(999)
    cfg, fetcher = setup()  # no robots opt-in for www.linkedin.com
    posts = await build_clients(cfg, fetcher)[SourceName.LINKEDIN_POSTS].search("customer churn")
    assert len(posts) == 1  # the duplicate, the company page and the thin page are dropped
    assert posts[0].source == SourceName.LINKEDIN_POSTS
    assert "Usage dropped for three weeks" in posts[0].text
    assert not linkedin.called


@respx.mock
async def test_linkedin_since_filter_applies_to_search_result_posts() -> None:
    respx.post(EXA_MCP_URL).respond(200, text=found(jfixture("exa_linkedin.json")))
    cfg, fetcher = setup()
    client = build_clients(cfg, fetcher)[SourceName.LINKEDIN_POSTS]
    assert await client.search("customer churn", since=datetime(2026, 9, 1, tzinfo=UTC)) == []


# ---- X ----------------------------------------------------------------------------------


@respx.mock
async def test_x_finds_tweet_ids_in_mirror_urls_and_reads_them_from_x() -> None:
    respx.post(EXA_MCP_URL).respond(200, text=found(jfixture("exa_x.json")))
    respx.get("https://cdn.syndication.twimg.com/robots.txt").respond(200, text="User-agent: *\nDisallow: /")
    oembed = respx.get("https://publish.x.com/oembed").respond(200, json=jfixture("x_oembed.json"))
    cfg, fetcher = setup()
    posts = await build_clients(cfg, fetcher)[SourceName.X].search("customer churn")
    asked = sorted(str(call.request.url.params["url"]) for call in oembed.calls)
    assert asked == [
        "https://x.com/founderbob/status/1700000000000000002",
        "https://x.com/janedoe/status/1700000000000000001",
    ]  # one per tweet: the second mirror of the same tweet, the profile, the blog and the handle-less URL are skipped
    assert len(posts) == 2
    assert all(p.tier == "oembed" and p.source == SourceName.X for p in posts)
