"""The Studio's written know-how: playbooks, styles, recipes and skills, loaded from package data.

Each file is Markdown with a small front-matter block (``key: value`` lines, lists as ``[a, b]``). The loader is
deliberately tiny: no YAML dependency, and the content is ours, so the format stays simple.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import cache
from importlib import resources
from typing import Literal

Kind = Literal["playbooks", "styles", "recipes", "skills"]
KINDS: tuple[Kind, ...] = ("playbooks", "styles", "recipes", "skills")
_FRONT = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
_WORD = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class Doc:
    kind: Kind
    slug: str
    title: str
    summary: str
    body: str
    tags: tuple[str, ...] = ()
    meta: dict[str, str] = field(default_factory=dict)

    @property
    def text(self) -> str:
        """The whole document as the model should read it."""
        return self.body

    def card(self) -> dict[str, object]:
        """A compact listing entry (no body)."""
        out: dict[str, object] = {"name": self.slug, "title": self.title, "summary": self.summary}
        if self.tags:
            out["tags"] = list(self.tags)
        out.update({k: v for k, v in self.meta.items() if k not in ("name", "description")})
        return out


def _parse_value(raw: str) -> str | tuple[str, ...]:
    raw = raw.strip()
    if raw.startswith("[") and raw.endswith("]"):
        return tuple(p.strip().strip("\"'") for p in raw[1:-1].split(",") if p.strip())
    return raw.strip("\"'")


def parse(kind: Kind, slug: str, source: str) -> Doc:
    meta: dict[str, str] = {}
    tags: tuple[str, ...] = ()
    body = source
    if m := _FRONT.match(source):
        body = source[m.end() :]
        for line in m.group(1).splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            parsed = _parse_value(value)
            if key.strip() == "tags" and isinstance(parsed, tuple):
                tags = parsed
            elif isinstance(parsed, str):
                meta[key.strip()] = parsed
    title = meta.pop("title", "") or meta.get("name", slug)
    summary = meta.pop("summary", "") or meta.get("description", "")
    return Doc(kind=kind, slug=slug, title=title, summary=summary, body=body.strip() + "\n", tags=tags, meta=meta)


@cache
def _load(kind: Kind) -> dict[str, Doc]:
    folder = resources.files("deno_studio").joinpath("content", kind)
    docs: dict[str, Doc] = {}
    for entry in sorted(folder.iterdir(), key=lambda e: e.name):
        if entry.name.endswith(".md"):
            slug = entry.name.removesuffix(".md")
            docs[slug] = parse(kind, slug, entry.read_text(encoding="utf-8"))
    return docs


def list_docs(kind: Kind) -> list[Doc]:
    return list(_load(kind).values())


def get_doc(kind: Kind, slug: str) -> Doc | None:
    return _load(kind).get(slug.strip().lower().removesuffix(".md"))


def search_docs(kind: Kind, query: str, *, limit: int = 5, **filters: str) -> list[Doc]:
    """Keyword ranking over title, summary, tags and body (title and tags weigh most). ``filters`` match front
    matter exactly (e.g. ``ratio="9:16"``)."""
    words = set(_WORD.findall(query.lower()))
    scored: list[tuple[float, str, Doc]] = []
    for doc in _load(kind).values():
        if any(v and doc.meta.get(k) != v for k, v in filters.items()):
            continue
        head = set(_WORD.findall(f"{doc.title} {doc.slug} {' '.join(doc.tags)}".lower()))
        summary = set(_WORD.findall(doc.summary.lower()))
        body = _WORD.findall(doc.body.lower())
        score = 3.0 * len(words & head) + 1.5 * len(words & summary) + 0.1 * sum(1 for w in body if w in words)
        if score > 0 or not words:
            scored.append((score, doc.slug, doc))
    scored.sort(key=lambda s: (-s[0], s[1]))
    return [d for _, _, d in scored[: max(1, limit)]]
