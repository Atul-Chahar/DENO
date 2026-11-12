"""The Rulebook (docs/14, docs/18 phase G): every rule in the playbooks and styles as a strikeable line.

A rule is one bullet line. Its id is the document slug plus a short hash of the text, so it survives reordering.
Core rules (the render contract, licences, honesty about facts) can't be struck: they keep renders working and
keep the founder out of trouble. A struck rule is left out when the founder's AI reads that playbook or style.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable
from dataclasses import dataclass

from deno_studio.library import Doc, Kind, list_docs

_BULLET = re.compile(r"^(\s*)[-*]\s+(.*)$")
_CORE_WORDS = ("licen", "invent", "never invent", "only from", "pure function", "seek(", "math.random", "unsure")


@dataclass(frozen=True)
class Rule:
    id: str
    doc: str
    kind: Kind
    text: str
    core: bool


def _rule_id(slug: str, text: str) -> str:
    return f"{slug}.{hashlib.sha1(text.strip().encode(), usedforsecurity=False).hexdigest()[:8]}"


def _is_core(doc: Doc, text: str) -> bool:
    if doc.meta.get("core") == "true" and doc.slug == "contract":
        return True
    low = text.lower()
    return any(w in low for w in _CORE_WORDS)


def _bullets(body: str) -> list[tuple[int, int, str]]:
    """Each bullet as (first line index, last line index, joined text); wrapped lines that are indented more than
    the dash belong to the bullet above them."""
    lines = body.splitlines()
    out: list[tuple[int, int, str]] = []
    i = 0
    while i < len(lines):
        m = _BULLET.match(lines[i])
        if not m:
            i += 1
            continue
        indent = len(m.group(1))
        parts = [m.group(2).strip()]
        j = i + 1
        while j < len(lines) and lines[j].strip() and not _BULLET.match(lines[j]):
            if len(lines[j]) - len(lines[j].lstrip()) <= indent:
                break
            parts.append(lines[j].strip())
            j += 1
        out.append((i, j - 1, " ".join(parts)))
        i = j
    return out


def rules_of(doc: Doc) -> list[Rule]:
    return [
        Rule(_rule_id(doc.slug, text), doc.slug, doc.kind, text, _is_core(doc, text))
        for _a, _b, text in _bullets(doc.body)
        if len(text) > 12
    ]


def all_rules(kinds: Iterable[Kind] = ("playbooks", "styles")) -> list[Rule]:
    return [r for kind in kinds for doc in list_docs(kind) for r in rules_of(doc)]


def strikeable(rule_ids: Iterable[str]) -> set[str]:
    """The subset of ids that exist and may be struck."""
    known = {r.id: r for r in all_rules()}
    return {i for i in rule_ids if i in known and not known[i].core}


def apply(doc: Doc, struck: set[str]) -> str:
    """The document's text without the founder's struck rules (core rules always stay)."""
    if not struck:
        return doc.body
    lines = doc.body.splitlines()
    drop: set[int] = set()
    for a, b, text in _bullets(doc.body):
        if _rule_id(doc.slug, text) in struck and not _is_core(doc, text):
            drop.update(range(a, b + 1))
    if not drop:
        return doc.body
    keep = [line for i, line in enumerate(lines) if i not in drop]
    note = "\n\n_(Some rules here were turned off by the founder in their Deno Rulebook.)_\n"
    return "\n".join(keep).rstrip() + note
