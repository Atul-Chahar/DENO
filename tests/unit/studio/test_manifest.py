"""film.json: validation, frame → clip mapping, reading-time and licence checks (docs/18 §5)."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from deno_studio import licences
from deno_studio.manifest import (
    FilmManifest,
    asset_findings,
    pending_findings,
    review_findings,
    timing_findings,
)


def film(**over: Any) -> FilmManifest:
    base: dict[str, Any] = {
        "schema": "deno.film/1",
        "title": "Launch",
        "formats": [{"ratio": "9:16"}],
        "fps": 30,
        "duration": 12,
        "chapters": [{"id": "ch1", "start": 0, "end": 6}, {"id": "ch2", "start": 6, "end": 12}],
        "clips": [
            {"id": "hook", "start": 0, "end": 2.5, "text": [{"t": 0.2, "end": 2.4, "text": "Your PRs wait 3 days"}]},
            {"id": "demo", "chapter": "ch2", "start": 2.5, "end": 12, "reads": [{"t": 3, "text": "it reviews itself"}]},
        ],
        "captions": [{"start": 0, "end": 1.2, "text": "Your PRs"}],
        "assets": [],
    }
    base.update(over)
    return FilmManifest.model_validate(base)


def rules(findings: list[dict[str, Any]]) -> set[str]:
    return {f["rule_id"] for f in findings}


def test_valid_film_has_no_blocking_findings() -> None:
    f = film()
    assert not [x for x in timing_findings(f) if x["severity"] == "block"]
    assert f.summary()["formats"] == ["9:16"]


def test_locate_maps_time_to_clip_and_chapter() -> None:
    f = film()
    assert f.locate(1.0) == {"clip_id": "hook", "clip_label": "", "chapter_id": "ch1"}
    assert f.locate(8.0)["clip_id"] == "demo" and f.locate(8.0)["chapter_id"] == "ch2"
    assert f.locate(99)["clip_id"] is None


def test_text_flashed_too_fast_is_blocked() -> None:
    f = film(
        clips=[
            {
                "id": "a",
                "start": 0,
                "end": 1,
                "text": [{"t": 0, "end": 0.5, "text": "seven words that nobody can read here"}],
            }
        ]
    )
    found = timing_findings(f)
    assert {"film.reading_time", "film.words_on_screen"} <= rules(found) or "film.reading_time" in rules(found)
    assert any(x["rule_id"] == "film.reading_time" and x["severity"] == "block" for x in found)


def test_too_many_words_overlaps_and_late_hook_are_warned() -> None:
    f = film(
        clips=[
            {
                "id": "a",
                "start": 2,
                "end": 12,
                "text": [{"t": 2, "end": 12, "text": "one two three four five six seven eight nine ten"}],
                "reads": [{"t": 3, "end": 6, "text": "x"}, {"t": 4, "text": "y"}],
            }
        ],
        captions=[{"start": 0, "end": 2, "text": "a"}, {"start": 1.5, "end": 3, "text": "b"}],
    )
    assert {"film.words_on_screen", "film.reads_overlap", "film.captions_overlap", "film.hook"} <= rules(
        timing_findings(f)
    )


def test_still_needs_pages_and_video_needs_duration() -> None:
    assert "film.pages" in rules(timing_findings(film(kind="still", pages=0)))
    assert "film.duration" in rules(timing_findings(film(duration=0)))


def test_unknown_ratio_is_rejected_unless_sized() -> None:
    with pytest.raises(ValidationError):
        film(formats=[{"ratio": "7:3"}])
    assert film(formats=[{"ratio": "7:3", "w": 1400, "h": 600}]).formats[0].size() == (1400, 600)


def test_licences() -> None:
    assert licences.check("CC0").commercial and not licences.check("CC0").credit_required
    assert licences.check("cc-by-4.0").credit_required
    assert not licences.check("cc-by-nc").commercial
    assert licences.normalise("whatever") == "unknown" and not licences.check(None).commercial


def test_assets_without_a_commercial_licence_block_finals_only() -> None:
    f = film(
        assets=[
            {"id": "freesound:1", "kind": "sfx", "license": "cc-by-nc"},
            {"id": "x", "kind": "image", "license": "cc-by"},
            {"id": "pexels:v:2", "kind": "video", "license": "pexels", "credit": "Ann on Pexels"},
        ]
    )
    draft = asset_findings(f, final=False)
    final = asset_findings(f, final=True)
    assert {x["severity"] for x in draft} == {"warn"}
    assert [x["rule_id"] for x in final if x["severity"] == "block"] == ["assets.licence", "assets.credit"]
    assert [x["message"] for x in final][1] == "x needs a credit and none is recorded"


def test_placeholders_warn_in_drafts_and_block_finals() -> None:
    f = FilmManifest.model_validate(
        {
            "duration": 6,
            "chapters": [{"id": "hook", "start": 0, "end": 2, "pending": True}],
            "clips": [
                {"id": "proof", "start": 2, "end": 4, "label": "Product proof", "pending": True, "kind": "screen"}
            ],
        }
    )
    draft = pending_findings(f, final=False)
    final = pending_findings(f, final=True)
    assert [d["severity"] for d in draft] == ["warn", "warn"]
    assert [d["severity"] for d in final] == ["block", "block"]
    assert "Product proof" in final[1]["message"]
    f.clips[0].pending = False
    f.chapters[0].pending = False
    assert pending_findings(f, final=True) == []


# ---- light uploads: the MP4s stay on the founder's disk ------------------------------------------

SHEET_INDEX = {
    "w": 1984,
    "h": 600,
    "frames": [
        {"t": 0.25, "x": 9.5, "y": 9.5, "w": 320, "h": 180},
        {"t": 2.25, "x": 337.5, "y": 9.5, "w": 320, "h": 180},
    ],
}


def test_a_video_version_without_an_mp4_saves_cleanly() -> None:
    """No 'review' file: a contact sheet (or a link) is enough, and nothing blocks or warns."""
    f = film(sheet_index=SHEET_INDEX)
    assert review_findings(f, {"poster": "u/poster.jpg", "sheet": "u/sheet.jpg"}) == []
    assert review_findings(film(external_url="https://youtu.be/dQw4w9WgXcQ"), {}) == []
    assert review_findings(film(stream_url="https://cdn.example.com/review.mp4"), {"poster": "p"}) == []
    assert review_findings(f, {"review": "u/review.mp4"}) == []  # the old path still works
    findings = timing_findings(f) + asset_findings(f, final=True) + review_findings(f, {"sheet": "s"})
    assert not [x for x in findings if x["severity"] == "block"]


def test_nothing_to_watch_is_a_warning_not_an_error() -> None:
    out = review_findings(film(), {"poster": "u/poster.jpg"})
    assert rules(out) == {"review.nothing_to_watch"} and out[0]["severity"] == "warn"
    still = film(kind="still", pages=1)
    assert review_findings(still, {}) == []


def test_video_links_and_sheet_index_round_trip() -> None:
    f = film(external_url="https://youtu.be/x", stream_url="https://r2.example.com/v.mp4", sheet_index=SHEET_INDEX)
    assert f.playable_url() == "https://r2.example.com/v.mp4"  # a direct file beats a page
    dumped = f.model_dump(mode="json", by_alias=True)
    assert dumped["external_url"] == "https://youtu.be/x" and len(dumped["sheet_index"]["frames"]) == 2
    assert film(external_url="").external_url is None
    assert film().playable_url() is None


@pytest.mark.parametrize("bad", ["http://insecure.example.com/v.mp4", "javascript:alert(1)", "youtu.be/x"])
def test_video_links_must_be_https(bad: str) -> None:
    with pytest.raises(ValidationError):
        film(external_url=bad)
    with pytest.raises(ValidationError):
        film(stream_url=bad)


def test_sheet_index_rejects_empty_boxes() -> None:
    with pytest.raises(ValidationError):
        film(sheet_index={"w": 100, "h": 100, "frames": [{"t": 0, "x": 0, "y": 0, "w": 0, "h": 10}]})


def test_internet_archive_licence_warns_but_never_blocks() -> None:
    lc = licences.check("archive-pd")
    assert lc.commercial and lc.warn and not lc.credit_required
    f = film(assets=[{"id": "archive:video:x", "kind": "video", "license": "archive-pd"}])
    out = asset_findings(f, final=True)
    assert rules(out) == {"assets.licence_check"} and out[0]["severity"] == "warn"
