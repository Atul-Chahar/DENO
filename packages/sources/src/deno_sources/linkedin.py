"""LinkedIn public posts and guest job listings.

LinkedIn's robots.txt and user agreement prohibit automated access without
permission. These clients therefore only fetch when the operator has opted the
host in (``robots_opt_in``), fetch single pages on a user-initiated run, stop on
999/authwall, and never log in. Legal review is an open PRD question.
"""

from __future__ import annotations

import json
import re
from datetime import datetime

from selectolax.parser import HTMLParser

from deno_sources.base import SourceClient, WebSearch
from deno_sources.models import Engagement, Post, SourceName
from deno_sources.net import Fetcher
from deno_sources.normalize import canonical_url, clean_text

POST_URL = re.compile(r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/posts/[^\s?#\"'<>]+")
_SLUG_HANDLE = re.compile(r"/posts/([A-Za-z0-9-]{2,100})_")
_EXA_TAIL = re.compile(r"^## (?:Engagement|Comments)\b", re.MULTILINE)
_REACTIONS = re.compile(r"^- Reactions: (\d+)", re.MULTILINE)
_COMMENTS = re.compile(r"^- Comments: (\d+)|^## Comments \(\d+ shown of (\d+) reported\)", re.MULTILINE)
MIN_POST_CHARS = 40
JOBS_API = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"


def _interaction(stats: object, kind: str) -> int | None:
    for stat in stats if isinstance(stats, list) else []:
        if isinstance(stat, dict) and kind in str(stat.get("interactionType", "")):
            count = stat.get("userInteractionCount")
            return int(count) if isinstance(count, int) else None
    return None


def parse_post_page(html: str, url: str) -> Post | None:
    tree = HTMLParser(html)
    for node in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(node.text())
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict) or data.get("@type") not in ("SocialMediaPosting", "DiscussionForumPosting"):
            continue
        text = clean_text(str(data.get("articleBody") or data.get("text") or ""))
        if not text:
            continue
        raw_author = data.get("author")
        author: dict[str, object] = raw_author if isinstance(raw_author, dict) else {}
        author_url = str(author.get("url") or "")
        handle = (
            author_url.rstrip("/").rsplit("/", 1)[-1] if "/in/" in author_url or "/company/" in author_url else None
        )
        published = None
        if isinstance(data.get("datePublished"), str):
            try:
                published = datetime.fromisoformat(str(data["datePublished"]).replace("Z", "+00:00"))
            except ValueError:
                published = None
        stats = data.get("interactionStatistic")
        return Post(
            source=SourceName.LINKEDIN_POSTS,
            url=url,
            canonical_url=canonical_url(url),
            text=text,
            title=clean_text(str(data.get("headline") or "")) or None,
            author_handle=handle,
            published_at=published,
            engagement=Engagement(
                likes=_interaction(stats, "LikeAction"),
                comments=_interaction(stats, "CommentAction") or _int(data.get("commentCount")),
            ),
            tier="jsonld",
        )
    # Fallback: Open Graph description (often truncated; no engagement).
    meta = tree.css_first('meta[property="og:description"]')
    text = clean_text(meta.attributes.get("content") or "") if meta else ""
    if len(text) < 40:
        return None
    return Post(
        source=SourceName.LINKEDIN_POSTS, url=url, canonical_url=canonical_url(url), text=text, tier="opengraph"
    )


def parse_exa_post(result: dict[str, str]) -> Post | None:
    """A post from the page text a search backend already extracted (Exa), so LinkedIn is not fetched.

    The text is a rendering of the public post page: a heading, the author's name and bio, a rule, the
    post, then engagement counts and comments. Only the post itself is kept; a comment is someone else's
    words and must not be attributed to the author.
    """
    url = result["url"]
    page = result.get("full_text", "")
    _, rule, after = page.partition("\n---\n")
    body = after if rule else page
    tail = _EXA_TAIL.search(body)
    lines = (body[: tail.start()] if tail else body).strip().splitlines()
    while lines and (not lines[-1].strip() or lines[-1].rstrip().endswith(" image")):
        lines.pop()  # the alt text of the post's picture
    text = clean_text("\n".join(lines))
    if len(text) < MIN_POST_CHARS:
        return None
    published = None
    if result.get("published"):
        try:
            published = datetime.fromisoformat(result["published"].replace("Z", "+00:00"))
        except ValueError:
            published = None
    handle = _SLUG_HANDLE.search(url)
    reactions, comments = _REACTIONS.search(page), _COMMENTS.search(page)
    return Post(
        source=SourceName.LINKEDIN_POSTS,
        url=url,
        canonical_url=canonical_url(url),
        text=text,
        title=clean_text(result.get("title", "").split(" | ")[0]) or None,
        author_handle=handle.group(1) if handle else None,
        published_at=published,
        engagement=Engagement(
            likes=int(reactions.group(1)) if reactions else None,
            comments=int(comments.group(1) or comments.group(2)) if comments else None,
        ),
        tier="exa",
    )


def parse_job_cards(html: str) -> list[Post]:
    tree = HTMLParser(html)
    posts: list[Post] = []
    seen: set[str] = set()
    for card in tree.css("div.base-card, li div.base-search-card"):
        link = card.css_first("a.base-card__full-link") or card.css_first("a")
        title = card.css_first(".base-search-card__title")
        company = card.css_first(".base-search-card__subtitle")
        location = card.css_first(".job-search-card__location")
        posted = card.css_first("time")
        href = (link.attributes.get("href") or "") if link else ""
        if not href or not title:
            continue
        url = href.split("?", 1)[0]
        if url in seen:
            continue
        seen.add(url)
        title_text = title.text(strip=True)
        company_text = company.text(strip=True) if company else None
        published = None
        if posted and posted.attributes.get("datetime"):
            try:
                published = datetime.fromisoformat(posted.attributes["datetime"] or "")
            except ValueError:
                published = None
        posts.append(
            Post(
                source=SourceName.LINKEDIN_JOBS,
                url=url,
                canonical_url=canonical_url(url),
                title=title_text,
                text=" · ".join(
                    filter(None, [title_text, company_text, location.text(strip=True) if location else None])
                ),
                community=company_text,
                published_at=published,
                kind="job",
                tier="jobs_guest",
            )
        )
    return posts


def _int(value: object) -> int | None:
    return int(value) if isinstance(value, int) else None


class LinkedInPostsClient(SourceClient):
    name = SourceName.LINKEDIN_POSTS

    def __init__(self, fetcher: Fetcher, searxng: WebSearch) -> None:
        super().__init__(fetcher)
        self.searxng = searxng

    async def discover(self, query: str, *, time_range: str | None = None) -> list[str]:
        results = await self.searxng.search(f'site:linkedin.com/posts "{query}"', time_range=time_range)
        urls = [m.group(0) for r in results if (m := POST_URL.search(r["url"]))]
        return list(dict.fromkeys(canonical_url(u) for u in urls))

    async def search(self, query: str, *, since: datetime | None = None, limit: int = 10) -> list[Post]:
        results = await self.searxng.search(f'site:linkedin.com/posts "{query}"')
        found: dict[str, dict[str, str]] = {}
        for r in results:
            if m := POST_URL.search(r["url"]):
                found.setdefault(canonical_url(m.group(0)), r)
        posts: list[Post] = []
        for url, result in list(found.items())[:limit]:
            # A backend that returns the page text (Exa) saves the fetch, which LinkedIn's robots.txt
            # only allows with the operator's opt-in.
            post = parse_exa_post({**result, "url": url}) if result.get("full_text") else await self.hydrate(url)
            if post and (since is None or post.published_at is None or post.published_at >= since):
                posts.append(post)
        return posts

    async def hydrate(self, url: str) -> Post | None:
        res = await self.fetcher.get(
            url,
            source=self.name,
            browser_ua=True,
            headers={"Accept-Language": "en-US,en;q=0.9"},
            cache_ttl_s=7 * 24 * 3600,
        )
        return parse_post_page(res.text, url) if res.status == 200 else None


class LinkedInJobsClient(SourceClient):
    """Hiring demand signal: how many companies are hiring for the problem space."""

    name = SourceName.LINKEDIN_JOBS

    async def search(self, query: str, *, since: datetime | None = None, limit: int = 25) -> list[Post]:
        params: dict[str, str | int] = {"keywords": query, "start": 0}
        if since:
            days = max(1, (datetime.now(since.tzinfo) - since).days)
            params["f_TPR"] = f"r{days * 86400}"
        res = await self.fetcher.get(JOBS_API, source=self.name, params=params, browser_ua=True, cache_ttl_s=24 * 3600)
        return parse_job_cards(res.text)[:limit] if res.status == 200 else []
