"""Builds the fetcher (host allow-list + access policy) and every client."""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urlsplit

from deno_sources.base import BraveSearchClient, ExaSearchClient, NoWebSearch, SearxngClient, SourceClient, WebSearch
from deno_sources.feeds import ProductHuntClient, TrendsClient
from deno_sources.hn import HackerNewsClient
from deno_sources.linkedin import LinkedInJobsClient, LinkedInPostsClient
from deno_sources.models import SourceName
from deno_sources.net import Cache, Fetcher, HostPolicy, Resolver, system_resolver
from deno_sources.reddit import RedditClient
from deno_sources.x import XClient

# Access basis per host. "api" = a documented programmatic endpoint (or robots.txt allows
# us); "robots" = robots.txt is checked and enforced unless the operator opts the host in.
HOSTS: dict[str, HostPolicy] = {
    "arctic-shift.photon-reddit.com": HostPolicy(rate_per_s=1.0, burst=2, access="api"),
    "hn.algolia.com": HostPolicy(rate_per_s=2.0, burst=4, access="api"),
    "publish.x.com": HostPolicy(rate_per_s=2.0, burst=4, access="api"),
    "cdn.syndication.twimg.com": HostPolicy(rate_per_s=2.0, burst=4, access="robots"),
    "www.linkedin.com": HostPolicy(rate_per_s=0.4, burst=1, access="robots"),
    "www.producthunt.com": HostPolicy(rate_per_s=0.5, burst=1, access="robots"),
    "trends.google.com": HostPolicy(rate_per_s=0.5, burst=1, access="robots"),
    "www.reddit.com": HostPolicy(rate_per_s=0.5, burst=1, access="robots"),
    "api.search.brave.com": HostPolicy(rate_per_s=1.0, burst=2, access="api"),
    # Keyless Exa answers 429 to a burst of more than about 3 searches: send them one at a time.
    "mcp.exa.ai": HostPolicy(rate_per_s=0.5, burst=1, access="api"),
    "api.exa.ai": HostPolicy(rate_per_s=2.0, burst=4, access="api"),
}

# Global per-source request caps per UTC day (cache hits don't count). Keeps us a
# low-volume, user-initiated visitor even if usage spikes.
DAILY_CAPS: dict[str, int] = {
    SourceName.REDDIT: 5000,
    SourceName.HN: 5000,
    SourceName.X: 3000,
    SourceName.LINKEDIN_POSTS: 300,
    SourceName.LINKEDIN_JOBS: 300,
    SourceName.PRODUCTHUNT: 500,
    SourceName.TRENDS: 200,
    "searxng": 3000,
    # Brave's free credit is ~1,000 queries a month; results are cached for a day.
    "web_search": 30,
    # Exa's keyless limit is not published; a run makes about 5 searches and results are cached for a day.
    "exa": 600,
}


@dataclass
class SourceConfig:
    searxng_url: str = ""
    web_search_provider: str = "searxng"  # exa | brave | searxng | none (docs/15)
    web_search_api_key: str = ""
    robots_opt_in: set[str] = field(default_factory=set)
    subreddits: list[str] = field(default_factory=list)
    user_agent: str | None = None
    daily_caps: dict[str, int] = field(default_factory=lambda: dict(DAILY_CAPS))


def build_fetcher(
    config: SourceConfig, *, cache: Cache | None = None, resolver: Resolver = system_resolver, **kw: object
) -> Fetcher:
    searx_host = (
        (urlsplit(config.searxng_url).hostname or "").lower() if config.web_search_provider == "searxng" else ""
    )
    options: dict[str, object] = {"cache": cache, "resolver": resolver, **kw}
    if config.user_agent:
        options["user_agent"] = config.user_agent
    return Fetcher(
        HOSTS,
        internal_hosts={searx_host: HostPolicy(rate_per_s=0.5, burst=2, access="api")} if searx_host else {},
        robots_opt_in=config.robots_opt_in,
        daily_caps=config.daily_caps,
        **options,  # type: ignore[arg-type]
    )


def build_web_search(config: SourceConfig, fetcher: Fetcher) -> WebSearch:
    if config.web_search_provider == "exa":
        return ExaSearchClient(fetcher, config.web_search_api_key)
    if config.web_search_provider == "brave" and config.web_search_api_key:
        return BraveSearchClient(fetcher, config.web_search_api_key)
    if config.web_search_provider == "searxng" and config.searxng_url:
        return SearxngClient(fetcher, config.searxng_url)
    return NoWebSearch()


def build_clients(config: SourceConfig, fetcher: Fetcher) -> dict[SourceName, SourceClient]:
    searx = build_web_search(config, fetcher)
    return {
        SourceName.REDDIT: RedditClient(fetcher, config.subreddits),
        SourceName.X: XClient(fetcher, searx),
        SourceName.LINKEDIN_POSTS: LinkedInPostsClient(fetcher, searx),
        SourceName.LINKEDIN_JOBS: LinkedInJobsClient(fetcher),
        SourceName.HN: HackerNewsClient(fetcher),
        SourceName.PRODUCTHUNT: ProductHuntClient(fetcher, searx),
        SourceName.TRENDS: TrendsClient(fetcher),
    }
