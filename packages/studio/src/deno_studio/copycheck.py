"""`check_copy` for video and stills: the anti-slop gates plus on-screen rules (docs/18 §3, phase E).

Posts use the full pipeline (``run_gates``) through the content API. Copy that is *seen or heard inside a video*
is shorter and broken into lines, so the post-shape rules (fragments, one sentence per line, link placement) don't
apply; the rest does: hidden characters, invented numbers, AI-tell phrases and vague paragraphs, plus limits on
words per screen and characters per caption line.
"""

from __future__ import annotations

from typing import Any, Literal

from deno_gates import Finding, GateContext, VoiceProfile, density, patterns, scrub, voice

CopyKind = Literal["on_screen", "captions", "voiceover"]
MAX_WORDS_PER_LINE = 8
MAX_CAPTION_CHARS = 42


def _finding(layer: str, f: Finding) -> dict[str, Any]:
    return {
        "layer": layer,
        "rule_id": f.rule_id,
        "severity": f.severity,
        "message": f.message,
        "quote": f.quote,
        "fix": f.fix,
    }


def check_video_copy(
    text: str,
    kind: CopyKind,
    *,
    allowed_numbers: frozenset[str] = frozenset(),
    allowed_number_words: frozenset[str] = frozenset(),
    profile: VoiceProfile | None = None,
) -> dict[str, Any]:
    ctx = GateContext(
        platform="linkedin",
        allowed_numbers=allowed_numbers,
        allowed_number_words=allowed_number_words,
        check_numbers=True,
        story_attached=None,
    )
    findings: list[dict[str, Any]] = []
    for layer in (scrub(text, ctx), patterns(text, ctx), density(text, ctx)):
        findings += [_finding(layer.layer, f) for f in layer.findings]
    if kind == "voiceover" and profile is not None:
        v = voice(text, ctx, profile=profile)
        findings += [_finding(v.layer, f) for f in v.findings]
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for line in lines:
        n = len(line.split())
        if kind == "on_screen" and n > MAX_WORDS_PER_LINE:
            findings.append(
                {
                    "layer": "on_screen",
                    "rule_id": "screen.words",
                    "severity": "warn",
                    "message": f"{n} words on one screen",
                    "quote": line[:160],
                    "fix": f"Keep each screen to {MAX_WORDS_PER_LINE} words; let the picture or the voice carry the rest.",
                }
            )
        if kind == "captions" and len(line) > MAX_CAPTION_CHARS * 2:
            findings.append(
                {
                    "layer": "captions",
                    "rule_id": "captions.length",
                    "severity": "warn",
                    "message": f"caption line is {len(line)} characters",
                    "quote": line[:160],
                    "fix": f"Split into lines of at most {MAX_CAPTION_CHARS} characters, two lines per caption.",
                }
            )
    blocking = [f for f in findings if f["severity"] == "block"]
    return {
        "passed": not blocking,
        "kind": kind,
        "blocking": len(blocking),
        "warnings": len(findings) - len(blocking),
        "findings": findings,
    }
