"""The persona learns from what the founder saves, approves and asks to fix (docs/18 §17.1)."""

from __future__ import annotations

import json
from typing import Any

from deno_studio import personas


def film(
    ratio: str = "9:16", duration: float = 12, recipe: str | None = "vertical-feature-15", **extra: Any
) -> dict[str, Any]:
    shots = [{"start": i * 1.0, "end": (i + 1) * 1.0} for i in range(int(duration))]
    return {
        "kind": "video",
        "formats": [{"ratio": ratio}],
        "duration": duration,
        "recipe": recipe,
        "clips": shots,
        **extra,
    }


def learn(*films: dict[str, Any], weight: int = 1) -> dict[str, Any]:
    learned: dict[str, Any] | None = None
    for f in films:
        learned = personas.observe_film(learned, f, weight)
    return learned or {}


def test_nothing_learned_changes_nothing() -> None:
    founder = personas.PERSONAS["founder"]
    assert personas.adapt(founder, None) == (founder, [])
    assert personas.adapt(founder, {}) == (founder, [])


def test_one_video_is_not_a_habit() -> None:
    founder = personas.PERSONAS["founder"]
    adapted, notes = personas.adapt(founder, learn(film()))
    assert adapted.recipe == founder.recipe and adapted.ratio == "16:9"
    assert notes == []


def test_a_founder_who_keeps_making_reels_gets_reel_defaults() -> None:
    founder = personas.PERSONAS["founder"]
    learned = learn(film(), film(), film(captionStyle={"preset": "beast-mode"}, style="vertical-captions"))
    adapted, notes = personas.adapt(founder, learned)
    assert adapted.recipe == "vertical-feature-15"
    assert "saas-launch-32" in adapted.also and "vertical-feature-15" not in adapted.also
    assert adapted.ratios[0] == "9:16" and "16:9" in adapted.ratios and len(adapted.ratios) <= 3
    assert adapted.length_s[0] <= 12 <= adapted.length_s[1]
    assert adapted.shot_s[0] <= 1.0 <= adapted.shot_s[1]  # one-second shots
    assert len(notes) >= 4 and all(n.endswith(".") for n in notes)
    # a single caption preset vote is not enough yet
    assert adapted.captions == founder.captions


def test_approval_counts_double() -> None:
    founder = personas.PERSONAS["founder"]
    learned = learn(film(ratio="1:1", recipe=None), film(ratio="1:1", recipe=None), weight=2)
    assert personas.adapt(founder, learned)[0].ratio == "1:1"


def test_review_notes_move_pacing_and_length() -> None:
    educator = personas.PERSONAS["educator"]
    learned: dict[str, Any] = {}
    for text in ("This drags in the middle", "Too slow, speed up", "lost me", "Too long overall", "trim it"):
        learned = personas.observe_note(learned, text, ["lost-interest"] if text == "lost me" else [])
    adapted, notes = personas.adapt(educator, learned)
    assert adapted.shot_s[0] < educator.shot_s[0]
    assert adapted.length_s[1] < educator.length_s[1]
    assert any("faster" in n for n in notes)

    rushed: dict[str, Any] = {}
    for _ in range(3):
        rushed = personas.observe_note(rushed, "Rushed, I can't read the captions", [])
    assert personas.adapt(personas.PERSONAS["creator"], rushed)[0].shot_s[0] > personas.PERSONAS["creator"].shot_s[0]


def test_notes_without_feedback_words_change_nothing() -> None:
    assert personas.observe_note({}, "Use the blue logo here", ["brand"]) == {}


def test_votes_are_capped_and_storage_stays_small() -> None:
    learned: dict[str, Any] = {}
    for i in range(40):
        learned = personas.observe_film(learned, film(ratio="9:16", recipe=f"r{i}", style=f"s{i}"))
        learned = personas.observe_note(learned, "too slow", [])
    assert learned["faster"] == 6
    assert len(learned["recipes"]) <= 8 and len(learned["lengths"]) <= 12 and len(learned["shot_s"]) <= 12
    assert len(json.dumps(learned)) < 2000


def test_stills_and_junk_are_ignored() -> None:
    assert personas.observe_film({}, {"kind": "still", "formats": [{"ratio": "4:5"}]}) == {}
    junk = personas.observe_film({"ratios": {"9:16": "x"}, "lengths": ["a"]}, {"formats": "nope", "clips": [1, None]})
    assert junk["videos"] == 1
    assert junk["ratios"] == {} and junk["lengths"] == [] and junk["shot_s"] == []
    personas.adapt(personas.PERSONAS["founder"], junk)  # no exception


def test_recipe_films_use_scenes_for_pacing() -> None:
    scenes = [{"start": 0, "end": 3}, {"start": 3, "end": 6}, {"start": 6, "end": 9}]
    learned = learn(*[film(clips=[], scenes=scenes, duration=9)] * 3)
    assert learned["shot_s"] == [3.0, 3.0, 3.0]


def test_a_clear_pattern_suggests_another_persona() -> None:
    founder = personas.PERSONAS["founder"]
    learned = learn(*[film()] * 4)
    assert personas.suggest(founder, learned) in {"creator", "agency"}
    assert personas.suggest(personas.PERSONAS["creator"], learned) is None  # already that
    block = personas.context("founder", learned)
    assert block["persona_suggestion"]["id"] in {"creator", "agency"}
    assert block["persona"]["learned"] and block["persona"]["videos_seen"] == 4
    assert personas.suggest(founder, learn(film(), film())) is None  # too early


def test_context_without_learning_has_empty_learned() -> None:
    block = personas.context("indie_dev")
    assert block["persona"]["learned"] == [] and "persona_suggestion" not in block
