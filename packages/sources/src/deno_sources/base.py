"""Source client contract and SearXNG discovery."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable, Mapping
from datetime import datetime
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
