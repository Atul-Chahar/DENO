"""Creator personas (docs/18 §17): every persona maps to defaults the kit and the content can actually use."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from deno_studio import get_doc, list_docs, personas
from deno_studio.library import parse

ROOT = Path(__file__).resolve().parents[3]
RUNNABLE = ROOT / "plugin" / "kit" / "template" / "recipes"
RATIOS = {"16:9", "9:16", "1:1", "4:5", "4:3"}


def test_the_five_personas_in_order() -> None:
    assert personas.PERSONA_IDS == ("founder", "creator", "indie_dev", "agency", "educator")
    assert list(personas.PERSONAS) == list(personas.PERSONA_IDS)
    assert personas.DEFAULT in personas.PERSONAS


@pytest.mark.parametrize("pid", personas.PERSONA_IDS)
def test_each_persona_maps_to_real_defaults(pid: str) -> None:
    p = personas.PERSONAS[pid]
    # The main recipe renders straight after `studio init --recipe`; the others exist in the catalogue.
    assert (RUNNABLE / f"{p.recipe}.json").exists(), p.recipe
    for slug in p.also:
        assert get_doc("recipes", slug) is not None, slug
    assert p.recipe not in p.also
    assert p.ratios and set(p.ratios) <= RATIOS and len(set(p.ratios)) == len(p.ratios)
    assert 5 <= p.length_s[0] <= p.length_s[1] <= 120
    assert 0.5 <= p.shot_s[0] <= p.shot_s[1] <= 6
    assert p.captions in personas.CAPTION_PRESETS
    assert get_doc("styles", p.style) is not None, p.style
    for text in (p.label, p.blurb, p.pacing, p.hook, p.tone, p.caption_note, p.sound, p.ending):
        assert text.strip()


def test_caption_presets_match_the_kit() -> None:
    src = (ROOT / "plugin" / "kit" / "lib" / "captions.mjs").read_text(encoding="utf-8")
    m = re.search(r"PRESET_WORDS = \{([^}]*)\}", src)
    assert m
    kit = set(re.findall(r"'?([a-z-]+)'?\s*:", m.group(1)))
    assert set(personas.CAPTION_PRESETS) == kit


def test_defaults_are_plain_json_with_the_main_ratio_first() -> None:
    d = personas.PERSONAS["agency"].defaults()
    assert json.loads(json.dumps(d)) == d
    assert d["ratio"] == d["ratios"][0] == "9:16"
    assert d["playbook"] == "personas"


def test_get_is_forgiving_about_case_and_rejects_unknown() -> None:
    assert personas.get(" Creator ") is personas.PERSONAS["creator"]
    assert personas.get("astronaut") is None
    assert personas.get(None) is None


def test_context_asks_until_answered() -> None:
    unset = personas.context(None)
    assert unset["persona"] is None
    assert "set_persona" in unset["persona_hint"]
    assert [c["id"] for c in unset["persona_choices"]] == list(personas.PERSONA_IDS)
    assert personas.context("educator")["persona"]["recipe"] == "explainer-30"
    assert personas.context("nonsense")["persona"] is None


def test_the_playbook_covers_every_persona_and_its_numbers() -> None:
    doc = get_doc("playbooks", "personas")
    assert doc is not None and "persona" in doc.tags
    for p in personas.PERSONAS.values():
        heading = f"## {p.label}"
        assert heading in doc.body, heading
        section = doc.body.split(heading, 1)[1].split("\n## ", 1)[0]
        assert f"`{p.recipe}`" in section and f"`{p.captions}`" in section, p.id
        assert p.ratio in section, p.id


def test_the_video_skills_read_the_persona() -> None:
    video = get_doc("skills", "video")
    assert video is not None
    assert "set_persona" in video.body and "Who are you?" in video.body and "`personas`" in video.body
    for slug in ("captions", "sound"):
        skill = get_doc("skills", slug)
        assert skill is not None and "persona" in skill.body, slug
    assert any(d.slug == "personas" for d in list_docs("playbooks"))


def test_the_web_list_matches() -> None:
    src = (ROOT / "web" / "lib" / "personas.ts").read_text(encoding="utf-8")
    web = re.findall(r"\{ id: '([a-z_]+)', label: '([^']+)'", src)
    assert web == [(p.id, p.label) for p in personas.PERSONAS.values()]


def test_parse_keeps_persona_playbook_front_matter() -> None:
    d = parse("playbooks", "x", "---\ntitle: T\nsummary: S\ntags: [core, persona]\n---\n# T\n")
    assert d.tags == ("core", "persona")
