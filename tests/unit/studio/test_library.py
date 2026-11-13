"""Studio know-how: every content file loads, is findable, and the Rulebook behaves (docs/18)."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from deno_studio import get_doc, list_docs, rulebook, search_docs
from deno_studio.library import KINDS, parse

ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize("kind", KINDS)
def test_every_document_has_a_title_summary_and_body(kind: str) -> None:
    docs = list_docs(kind)  # type: ignore[arg-type]
    assert docs, kind
    for d in docs:
        assert d.title and d.summary and len(d.body) > 150, d.slug


def test_expected_catalogue() -> None:
    assert len(list_docs("styles")) == 8
    assert len(list_docs("recipes")) == 14
    assert {d.slug for d in list_docs("skills")} == {
        "video",
        "sound",
        "captions",
        "voice",
        "stills",
        "posts",
        "review",
        "footage",
    }
    assert {
        "contract",
        "preproduction",
        "timing",
        "review",
        "platforms",
        "stills",
        "build-loop",
        "conversation",
        "sources",
        "behind-subject",
    } <= {d.slug for d in list_docs("playbooks")}


def test_skills_carry_plugin_frontmatter() -> None:
    for d in list_docs("skills"):
        assert d.meta["name"] == d.slug
        assert len(d.summary) > 60  # the plugin's description is what triggers the skill


def test_search_ranks_by_title_and_tags_and_filters() -> None:
    assert search_docs("recipes", "vertical reel feature")[0].slug == "vertical-feature-15"
    assert all(d.meta["ratio"] == "9:16" for d in search_docs("recipes", "", limit=20, ratio="9:16"))
    assert get_doc("styles", "LIVING-UI.md") is not None
    assert get_doc("styles", "nope") is None


def test_front_matter_parser() -> None:
    d = parse("styles", "x", '---\ntitle: A\nsummary: B\ntags: [one, "two"]\nratio: "9:16"\n---\n# Body\n')
    assert (d.title, d.summary, d.tags, d.meta["ratio"], d.body) == ("A", "B", ("one", "two"), "9:16", "# Body\n")


def test_rulebook_ids_are_stable_and_core_rules_cannot_be_struck() -> None:
    rules = rulebook.all_rules()
    assert len({r.id for r in rules}) == len(rules)
    core = [r for r in rules if r.core]
    soft = [r for r in rules if not r.core]
    assert core and soft
    assert rulebook.strikeable([core[0].id, soft[0].id, "made.up"]) == {soft[0].id}
    contract = get_doc("playbooks", "contract")
    assert contract is not None
    assert all(r.core for r in rulebook.rules_of(contract))


def test_struck_rule_disappears_from_the_text_but_core_stays() -> None:
    doc = get_doc("playbooks", "timing")
    assert doc is not None
    target = rulebook.rules_of(doc)[0]
    text = rulebook.apply(doc, {target.id})
    assert target.text not in text and "Rulebook" in text
    contract = get_doc("playbooks", "contract")
    assert contract is not None
    first = rulebook.rules_of(contract)[0]
    assert first.text[:40] in rulebook.apply(contract, {first.id})


def _glob_re(glob: str) -> re.Pattern[str]:
    """Vercel's matcher: ``**`` crosses folders, ``*`` doesn't."""
    out = ""
    i = 0
    while i < len(glob):
        if glob.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif glob.startswith("**", i):
            out, i = out + ".*", i + 2
        elif glob[i] == "*":
            out, i = out + "[^/]*", i + 1
        else:
            out, i = out + re.escape(glob[i]), i + 1
    return re.compile(out + r"\Z")


def test_vercel_bundle_keeps_studio_content() -> None:
    """vercel.json excludes Markdown from the API bundle; the Studio's content is Markdown and must ship."""
    pattern = json.loads((ROOT / "vercel.json").read_text())["functions"]["server/app.py"]["excludeFiles"]
    globs = [_glob_re(g) for g in pattern.strip("{}").split(",")]
    files = [f.relative_to(ROOT).as_posix() for f in (ROOT / "packages/studio/src/deno_studio/content").rglob("*.md")]
    assert len(files) > 40
    for rel in files:
        assert not any(g.match(rel) for g in globs), rel
    assert any(g.match("README.md") for g in globs) and any(g.match("plugin/kit/bin/studio.mjs") for g in globs)


def test_wrapped_bullets_are_one_rule_and_strike_cleanly() -> None:
    doc = get_doc("playbooks", "captions")
    assert doc is not None
    rule = next(r for r in rulebook.rules_of(doc) if r.text.startswith("**Timing from the audio:**"))
    assert rule.text.endswith("`captions.vtt`.")  # all wrapped lines joined
    text = rulebook.apply(doc, {rule.id})
    assert "Timing from the audio" not in text and "word timings to `captions.json`" not in text
    assert "Burned-in (vertical)" in text


def test_sources_playbook_promises_zero_keys() -> None:
    """Media search works with no API keys: the playbook says so and names every keyless path."""
    doc = get_doc("playbooks", "sources")
    assert doc is not None
    body = doc.body
    assert "no API key is needed" in body
    for needle in ("Wikimedia Commons", "Internet Archive", "studio search youtube", "ytsearch3:", "synth"):
        assert needle in body, needle


def test_delivery_playbook_keeps_mp4s_local() -> None:
    """`studio upload` sends ~250 KB (poster + sheet + film.json); the master and review MP4s stay on disk."""
    doc = get_doc("playbooks", "delivery")
    assert doc is not None
    body = doc.body
    assert "stay on the founder's machine" in body and "--video-url" in body and "--with-video" in body
