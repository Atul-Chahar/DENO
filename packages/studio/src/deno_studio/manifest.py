"""``film.json``: the manifest the studio kit keeps next to the founder's own HTML (docs/18 §5).

It is not a scene description. The picture is the founder's AI's own code; the manifest records what Deno needs to
check and review a version: formats, chapters and clips (so a frame note maps to the code that drew it), what the
viewer must read and when, captions, sound cues, and every third-party asset with its licence.
"""

from __future__ import annotations

import itertools
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from deno_studio import licences

RATIOS = {"9:16": (1080, 1920), "1:1": (1080, 1080), "4:5": (1080, 1350), "16:9": (1920, 1080), "1.91:1": (1200, 630)}
# Upper bound per platform shape (s); beyond this a warning, not an error.
LONG_FOR = {"9:16": 90.0, "1:1": 120.0, "4:5": 120.0, "16:9": 600.0, "1.91:1": 60.0}
SECONDS_PER_WORD = 0.3
MIN_HOLD_S = 1.0
MAX_WORDS_ON_SCREEN = 8
_WORD = re.compile(r"[\w'’%$€£₹.,-]+")


class _Base(BaseModel):
    model_config = ConfigDict(extra="allow", str_strip_whitespace=True)


class Format(_Base):
    ratio: str = "16:9"
    w: int | None = Field(default=None, ge=64, le=4096)
    h: int | None = Field(default=None, ge=64, le=4096)

    def size(self) -> tuple[int, int]:
        default = RATIOS.get(self.ratio, (1920, 1080))
        return self.w or default[0], self.h or default[1]


class Span(_Base):
    t: float = Field(ge=0)
    end: float | None = Field(default=None, ge=0)
    text: str = Field(max_length=2000)


class Clip(_Base):
    id: str = Field(max_length=64)
    chapter: str | None = Field(default=None, max_length=64)
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    label: str = Field(default="", max_length=300)
    reads: list[Span] = Field(default_factory=list, max_length=50)
    text: list[Span] = Field(default_factory=list, max_length=100)
    pending: bool = Field(default=False, description="a placeholder whose content isn't built yet (studio place)")


class Chapter(_Base):
    id: str = Field(max_length=64)
    title: str = Field(default="", max_length=200)
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    file: str | None = Field(default=None, max_length=200)
    pending: bool = False


class Caption(_Base):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str = Field(max_length=500)


class Cue(_Base):
    t: float = Field(ge=0)
    kind: str = Field(max_length=32)


class Asset(_Base):
    id: str = Field(max_length=200, description="search_media id (pexels:v:123) or a local name")
    kind: Literal["video", "image", "sfx", "music", "font", "icon", "voice", "screenshot", "other"] = "other"
    file: str | None = Field(default=None, max_length=300)
    source: str = Field(default="", max_length=64)
    license: str = Field(default="unknown", max_length=64)
    credit: str = Field(default="", max_length=300)
    source_url: str | None = Field(default=None, max_length=1000)


class SheetFrame(_Base):
    """One tile of the uploaded contact sheet: its time and its box in the sheet image (pixels)."""

    t: float = Field(ge=0)
    x: float = Field(ge=0)
    y: float = Field(ge=0)
    w: float = Field(gt=0)
    h: float = Field(gt=0)


class SheetIndex(_Base):
    """Where each frame sits in ``sheet.jpg``, so the review page can scrub the sheet like a timeline."""

    w: float = Field(gt=0, description="sheet width in px when the boxes were measured")
    h: float = Field(gt=0)
    frames: list[SheetFrame] = Field(default_factory=list, max_length=120)


_PLAYABLE = re.compile(r"^https://[^\s]{4,990}$")


class BeatGrid(_Base):
    bpm: float = Field(gt=20, lt=400)
    offset: float = Field(default=0.0, ge=0)


class FilmManifest(_Base):
    schema_: str = Field(default="deno.film/1", alias="schema")
    title: str = Field(default="Untitled", max_length=200)
    kind: Literal["video", "still"] = "video"
    style: str | None = Field(default=None, max_length=64)
    recipe: str | None = Field(default=None, max_length=64)
    formats: list[Format] = Field(default_factory=lambda: [Format()], min_length=1, max_length=6)
    fps: int = Field(default=30, ge=1, le=120)
    duration: float = Field(default=0.0, ge=0, le=1800)
    pages: int = Field(default=0, ge=0, le=30)
    stage: Literal["plan", "stills", "rough", "final"] = "plan"
    beat_grid: BeatGrid | None = Field(default=None, alias="beatGrid")
    chapters: list[Chapter] = Field(default_factory=list, max_length=50)
    clips: list[Clip] = Field(default_factory=list, max_length=300)
    captions: list[Caption] = Field(default_factory=list, max_length=2000)
    cues: list[Cue] = Field(default_factory=list, max_length=2000)
    assets: list[Asset] = Field(default_factory=list, max_length=300)
    # The MP4s stay on the founder's disk. A playable copy, if any, lives elsewhere (YouTube unlisted, R2, a
    # tunnel) and the review page embeds it; Deno stores only the poster, the contact sheet and this manifest.
    external_url: str | None = Field(default=None, max_length=1000, description="a page that plays the video")
    stream_url: str | None = Field(default=None, max_length=1000, description="a direct MP4/WebM/HLS link")
    sheet_index: SheetIndex | None = None

    model_config = ConfigDict(extra="allow", populate_by_name=True, str_strip_whitespace=True)

    @field_validator("formats")
    @classmethod
    def _known_ratio(cls, v: list[Format]) -> list[Format]:
        for f in v:
            if f.ratio not in RATIOS and not (f.w and f.h):
                raise ValueError(f"unknown ratio {f.ratio!r}; use one of {', '.join(RATIOS)} or give w and h")
        return v

    @field_validator("external_url", "stream_url")
    @classmethod
    def _https(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if not _PLAYABLE.match(v):
            raise ValueError("a video link must be a full https:// URL")
        return v

    def playable_url(self) -> str | None:
        return self.stream_url or self.external_url

    def locate(self, t: float) -> dict[str, str | None]:
        """The chapter and clip on screen at ``t`` (the latest-starting clip that covers it)."""
        clip = max(
            (c for c in self.clips if c.start <= t < max(c.end, c.start + 1e-6)), key=lambda c: c.start, default=None
        )
        chapter = next((c for c in self.chapters if c.start <= t < c.end), None)
        chapter_id = clip.chapter if clip and clip.chapter else (chapter.id if chapter else None)
        return {
            "clip_id": clip.id if clip else None,
            "clip_label": clip.label if clip else None,
            "chapter_id": chapter_id,
        }

    def copy_lines(self) -> list[tuple[str, str]]:
        """Every piece of text a viewer reads or hears that the manifest knows about: (kind, text)."""
        out: list[tuple[str, str]] = [("on_screen", s.text) for c in self.clips for s in c.text]
        out += [("captions", c.text) for c in self.captions]
        return [(k, t) for k, t in out if t]

    def summary(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "kind": self.kind,
            "style": self.style,
            "formats": [f.ratio for f in self.formats],
            "duration": self.duration,
            "pages": self.pages,
            "chapters": len(self.chapters),
            "clips": len(self.clips),
            "captions": len(self.captions),
            "assets": len(self.assets),
        }


def _words(text: str) -> int:
    return len(_WORD.findall(text))


def timing_findings(film: FilmManifest) -> list[dict[str, Any]]:
    """Deterministic checks on reading time, words per screen, overlaps and lengths. Each finding:
    ``{rule_id, severity, t, message, fix}``."""
    out: list[dict[str, Any]] = []

    def add(rule: str, severity: str, t: float | None, message: str, fix: str) -> None:
        out.append({"rule_id": rule, "severity": severity, "t": t, "message": message, "fix": fix})

    spans: list[tuple[float, float, str]] = []
    for clip in film.clips:
        if clip.end <= clip.start:
            add("film.clip_order", "block", clip.start, f"clip {clip.id} ends before it starts", "fix start/end")
        if film.duration and clip.end > film.duration + 0.05:
            add("film.clip_past_end", "warn", clip.start, f"clip {clip.id} runs past the film's end", "trim it")
        for s in clip.text:
            end = s.end if s.end is not None else clip.end
            spans.append((s.t, end, s.text))
    spans += [(c.start, c.end, c.text) for c in film.captions]
    for start, end, text in spans:
        n = _words(text)
        need = max(MIN_HOLD_S, n * SECONDS_PER_WORD)
        held = end - start
        if held + 1e-6 < need:
            add(
                "film.reading_time",
                "block" if held < need * 0.6 else "warn",
                start,
                f"“{text[:60]}” is on screen {held:.1f} s; {n} words need about {need:.1f} s",
                f"hold it {need:.1f} s or cut words",
            )
    for clip in film.clips:
        for s in clip.text:
            if _words(s.text) > MAX_WORDS_ON_SCREEN:
                add(
                    "film.words_on_screen",
                    "warn",
                    s.t,
                    f"{_words(s.text)} words on screen at once: “{s.text[:60]}”",
                    f"keep it to {MAX_WORDS_ON_SCREEN} words; move the rest to voice or captions",
                )
        reads = sorted(clip.reads, key=lambda r: r.t)
        for a, b in itertools.pairwise(reads):
            a_end = a.end if a.end is not None else b.t
            if b.t < a_end - 1e-6:
                add("film.reads_overlap", "warn", b.t, f"two reads overlap in clip {clip.id}", "one read at a time")
    caps = sorted(film.captions, key=lambda c: c.start)
    for prev, nxt in itertools.pairwise(caps):
        if nxt.start < prev.end - 0.02:
            add("film.captions_overlap", "warn", nxt.start, "two captions overlap", "end one before the next starts")
    if film.kind == "video":
        if film.duration <= 0:
            add("film.duration", "block", None, "duration is missing", "set duration in film.json")
        for f in film.formats:
            limit = LONG_FOR.get(f.ratio)
            if limit and film.duration > limit:
                add(
                    "film.length",
                    "warn",
                    None,
                    f"{film.duration:.0f} s is long for {f.ratio}",
                    f"aim under {limit:.0f} s",
                )
        if film.clips and min(c.start for c in film.clips) > 1.0:
            add("film.hook", "warn", 0.0, "nothing is recorded in the first second", "open on the result or the pain")
    elif film.pages <= 0:
        add("film.pages", "block", None, "a still needs pages (1 for a poster)", "set pages in film.json")
    return out


def asset_findings(film: FilmManifest, *, final: bool) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for a in film.assets:
        lc = licences.check(a.license)
        if not lc.commercial:
            out.append(
                {
                    "rule_id": "assets.licence",
                    "severity": "block" if final else "warn",
                    "t": None,
                    "message": f"{a.id}: {lc.note}",
                    "fix": "replace it with a CC0, Pexels, Pixabay, synthesized or own asset",
                }
            )
        elif lc.warn:
            out.append(
                {
                    "rule_id": "assets.licence_check",
                    "severity": "warn",
                    "t": None,
                    "message": f"{a.id}: {lc.note}",
                    "fix": "confirm the terms",
                }
            )
        if lc.commercial and lc.credit_required and not a.credit:
            out.append(
                {
                    "rule_id": "assets.credit",
                    "severity": "block" if final else "warn",
                    "t": None,
                    "message": f"{a.id} needs a credit and none is recorded",
                    "fix": "add credit (author, source) in film.json; it goes in the post description",
                }
            )
    return out


def pending_findings(film: FilmManifest, *, final: bool) -> list[dict[str, Any]]:
    """Placeholders (``pending`` chapters and clips) still in the film: a draft may show them, a final may not."""
    items = [("chapter", c.id, c.title, c.start) for c in film.chapters if c.pending] + [
        ("clip", c.id, c.label, c.start) for c in film.clips if c.pending
    ]
    return [
        {
            "rule_id": "film.pending",
            "severity": "block" if final else "warn",
            "t": start,
            "message": f"{kind} {label or ident} is still a placeholder",
            "fix": "build it, then `studio fill <id>`",
        }
        for kind, ident, label, start in items
    ]


def review_findings(film: FilmManifest, files: dict[str, Any]) -> list[dict[str, Any]]:
    """A video version needs no MP4 on Deno; it only needs *something* the founder can look at."""
    if film.kind != "video" or files.get("review") or files.get("sheet") or film.playable_url():
        return []
    return [
        {
            "rule_id": "review.nothing_to_watch",
            "severity": "warn",
            "t": None,
            "message": "this version has no contact sheet and no video link, so the review page can only show the poster",
            "fix": "run `studio sheet` before `studio upload`, or pass --video-url with an unlisted link",
        }
    ]
