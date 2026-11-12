"""Source client contract and web-search discovery (Exa, Brave, SearXNG)."""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import Protocol

from deno_sources.models import Post, SourceName, SourceUnavailable
from deno_sources.net import Fetcher, FetchResult

# Extra request headers, fetched per request (e.g. a short-lived ID token for a private SearXNG).
HeaderProvider = Callable[[], Awaitable[Mapping[str, str]]]


class SourceClient(ABC):
    name: SourceName

    def __init__(self, fetcher: Fetcher) -> None:
        self.fetcher = fetcher

    @abstractmethod
    async def search(self, query: str, *, since: datetime | None = None, limit: int = 25) -> list[Post]:
        """Discover posts for a query (may return partially hydrated posts)."""

    async def hydrate(self, url: str) -> Post | None:
        """Fetch one known URL in full. Default: not supported by this source."""
        return None


class WebSearch(Protocol):
    """`site:` discovery for sources without a search API of their own (X, Product Hunt, LinkedIn posts).

    Results are ``{"url", "title", "content"}`` dicts. ``time_range`` is day | week | month | year.
    """

    async def search(self, query: str, *, time_range: str | None = None, pages: int = 1) -> list[dict[str, str]]: ...


class NoWebSearch:
    """No search backend configured: the sources that need one say so instead of finding nothing."""

    async def search(self, query: str, *, time_range: str | None = None, pages: int = 1) -> list[dict[str, str]]:
        raise SourceUnavailable("web search is not configured")


BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
BRAVE_FRESHNESS = {"day": "pd", "week": "pw", "month": "pm", "year": "py"}


class BraveSearchClient:
    """Web search through the Brave Search API (hosted; no server of our own to run)."""

    def __init__(self, fetcher: Fetcher, api_key: str) -> None:
        self.fetcher = fetcher
        self._headers = {"X-Subscription-Token": api_key, "Accept": "application/json"}

    async def search(self, query: str, *, time_range: str | None = None, pages: int = 1) -> list[dict[str, str]]:
        results: list[dict[str, str]] = []
        for page in range(min(pages, 10)):
            params: dict[str, str | int] = {"q": query, "count": 20, "offset": page}
            if time_range in BRAVE_FRESHNESS:
                params["freshness"] = BRAVE_FRESHNESS[time_range]
            res = await self.fetcher.get(
                BRAVE_SEARCH_URL, source="web_search", params=params, headers=self._headers, cache_ttl_s=24 * 3600
            )
            if res.status != 200:
                if page == 0:
                    raise SourceUnavailable(f"search answered HTTP {res.status}")
                break
            data = res.json()
            web = data.get("web", {}) if isinstance(data, dict) else {}
            batch = web.get("results", []) if isinstance(web, dict) else []
            results.extend(
                {"url": r.get("url", ""), "title": r.get("title", ""), "content": r.get("description", "")}
                for r in batch
                if isinstance(r, dict) and r.get("url")
            )
            more = data.get("query", {}).get("more_results_available") if isinstance(data, dict) else False
            if not batch or not more:
                break
        return results


# Exa's hosted search endpoint (JSON-RPC over HTTP). It answers without a key at a lower rate limit; the
# advanced tool is the one that takes a domain filter, and has to be asked for in the URL.
EXA_TOOL = "web_search_advanced_exa"
EXA_MCP_URL = f"https://mcp.exa.ai/mcp?tools={EXA_TOOL}"
# With a key we use Exa's documented search API instead: published limits, billed per request, and not
# shared with every other keyless caller on the same Vercel egress IP.
EXA_API_URL = "https://api.exa.ai/search"
EXA_TEXT_CHARS = 8000
EXA_MAX_RESULTS = 25
EXA_ATTEMPTS = 2
EXA_RETRY_WAIT_S = 3.0
EXA_WINDOW_DAYS = {"day": 1, "week": 7, "month": 31, "year": 365}
# Exa has no index of X: a domain filter on it finds nothing. It does index public mirrors of tweets,
# whose URLs carry the handle and status id that X's own embed API can then be asked about. Measured
# live on three ideas: 17-23 tweet ids per search this way, 0 from an unfiltered search.
EXA_X_SITES = frozenset({"x.com", "twitter.com"})
EXA_X_MIRRORS = ("twiscan.com",)
_SITE_QUERY = re.compile(r"^\s*site:(\S+)\s*(.*)$", re.DOTALL)


def exa_results(res: FetchResult) -> list[dict[str, object]] | None:
    """The result rows of an Exa answer; None when the body is not an answer (error, rate limit, junk)."""
    if res.status != 200:
        return None
    # Not splitlines(): it also splits on U+2028 and U+0085, which sit unescaped inside the JSON of a post.
    events = [line[5:].strip() for line in res.text.split("\n") if line.startswith("data:")]
    try:
        message = json.loads(events[-1] if events else res.text)
        result = message["result"]
        if result.get("isError"):
            return None
        text = "\n".join(c.get("text", "") for c in result["content"] if c.get("type") == "text")
        rows = json.loads(text).get("results", [])
    except (ValueError, KeyError, TypeError, AttributeError):
        return None
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else None


class ExaSearchClient:
    """Web search through Exa's hosted endpoint. Works without a key; ``api_key`` raises the rate limit.

    A leading ``site:`` operator becomes Exa's domain filter. Results carry the page text Exa extracted
    (``full_text``), so a source can build a post from the search result without fetching the page.
    """

    def __init__(self, fetcher: Fetcher, api_key: str = "") -> None:
        self.fetcher = fetcher
        self._api_key = api_key
        self._headers = {"Accept": "application/json, text/event-stream"}
        if api_key:
            self._headers = {"Accept": "application/json", "x-api-key": api_key}

    async def search(self, query: str, *, time_range: str | None = None, pages: int = 1) -> list[dict[str, str]]:
        match = _SITE_QUERY.match(query)
        site, text = (match.group(1).lower(), match.group(2)) if match else ("", query)
        text = " ".join(text.replace('"', " ").split())  # semantic search: quotes only narrow it to nothing
        arguments: dict[str, object] = {"query": text, "numResults": min(EXA_MAX_RESULTS, 10 * max(pages, 1))}
        if site in EXA_X_SITES:
            arguments.update(query=f"tweet: {text}", numResults=EXA_MAX_RESULTS, includeDomains=list(EXA_X_MIRRORS))
        elif site:
            arguments["includeDomains"] = [site]
        if time_range in EXA_WINDOW_DAYS:
            start = datetime.now(UTC) - timedelta(days=EXA_WINDOW_DAYS[time_range])
            arguments["startPublishedDate"] = start.strftime("%Y-%m-%dT00:00:00.000Z")
        url, payload, parse = self._request(arguments)
        for attempt in range(EXA_ATTEMPTS):
            res = await self.fetcher.post_json(
                url,
                source="exa",
                payload=payload,
                headers=self._headers,
                cache_ttl_s=24 * 3600,
                cacheable=lambda r: parse(r) is not None,
            )
            rows = parse(res)
            if rows is not None or res.status != 200 or attempt + 1 == EXA_ATTEMPTS:
                break
            await self.fetcher.sleep(EXA_RETRY_WAIT_S)  # a 200 that is not an answer is usually the rate limit
        if rows is None:
            # A rate limit or a tool error comes back as HTTP 200: it must not read as "nobody posts about this".
            raise SourceUnavailable(f"search answered HTTP {res.status} without results")
        results: list[dict[str, str]] = []
        for row in rows:
            url, body = str(row.get("url") or ""), str(row.get("text") or "")
            if not url:
                continue
            results.append(
                {
                    "url": url,
                    "title": str(row.get("title") or ""),
                    "content": body[:500],
                    "full_text": body,
                    "author": str(row.get("author") or ""),
                    "published": str(row.get("publishedDate") or ""),
                }
            )
        return results

    def _request(
        self, arguments: dict[str, object]
    ) -> tuple[str, dict[str, object], Callable[[FetchResult], list[dict[str, object]] | None]]:
        """The documented search API when we have a key, else the keyless hosted endpoint (JSON-RPC)."""
        if self._api_key:
            body = {**arguments, "type": "auto", "contents": {"text": {"maxCharacters": EXA_TEXT_CHARS}}}
            return EXA_API_URL, body, exa_api_results
        rpc = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": EXA_TOOL, "arguments": arguments}}
        return EXA_MCP_URL, rpc, exa_results


def exa_api_results(res: FetchResult) -> list[dict[str, object]] | None:
    """Result rows of Exa's search API (``POST /search``); None when the body is not an answer."""
    if res.status != 200:
        return None
    try:
        rows = json.loads(res.text)["results"]
    except (ValueError, KeyError, TypeError):
        return None
    return [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else None


class SearxngClient:
    """Web search through a self-hosted SearXNG (JSON API). Local development only."""

    def __init__(self, fetcher: Fetcher, base_url: str, headers: HeaderProvider | None = None) -> None:
        self.fetcher = fetcher
        self.base_url = base_url.rstrip("/")
        self._headers = headers

    async def search(self, query: str, *, time_range: str | None = None, pages: int = 1) -> list[dict[str, str]]:
        results: list[dict[str, str]] = []
        for page in range(1, pages + 1):
            params: dict[str, str | int] = {"q": query, "format": "json", "pageno": page}
            if time_range:
                params["time_range"] = time_range  # day | week | month | year
            res = await self.fetcher.get(
                f"{self.base_url}/search",
                source="searxng",
                params=params,
                headers=await self._headers() if self._headers else None,
                cache_ttl_s=24 * 3600,
                cacheable=lambda r: blocked_engines(r) is None,
            )
            if res.status != 200:
                if page == 1:
                    raise SourceUnavailable(f"search answered HTTP {res.status}")
                break
            if page == 1 and (blocked := blocked_engines(res)):
                # Indistinguishable from "nobody talks about this" unless we say so.
                raise SourceUnavailable(f"search engines blocked: {blocked}")
            data = res.json()
            batch = data.get("results", []) if isinstance(data, dict) else []
            results.extend(
                {"url": r.get("url", ""), "title": r.get("title", ""), "content": r.get("content", "")}
                for r in batch
                if isinstance(r, dict) and r.get("url")
            )
            if not batch:
                break
        return results


def blocked_engines(res: FetchResult) -> str | None:
    """Which upstream engines refused us, when SearXNG answered 200 with no results because of it.

    SearXNG reports CAPTCHAs and rate limits in ``unresponsive_engines`` (``[[name, reason], ...]``)
    while still returning HTTP 200 - so an empty result list on its own means nothing.
    """
    if res.status != 200:
        return None
    try:
        data = res.json()
    except ValueError:
        return None
    if not isinstance(data, dict) or data.get("results"):
        return None
    pairs = [e for e in data.get("unresponsive_engines") or [] if isinstance(e, list | tuple) and e]
    if not pairs:
        return None
    return ", ".join(f"{e[0]} ({e[1]})" if len(e) > 1 and e[1] else str(e[0]) for e in pairs)[:200]
