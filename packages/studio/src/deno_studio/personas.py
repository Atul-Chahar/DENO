"""Creator personas (docs/18 §17): "Who are you?" asked once, answered once, followed by every video skill.

A persona turns into concrete defaults: a runnable recipe, the ratio(s), a length, the pacing (seconds per shot),
the hook style, the tone, the caption preset and a style. The founder's own request always wins; these are the
answers the AI suggests when they say "use your defaults". The words behind each one live in the ``personas``
playbook; this module is the single source for the ids and numbers (API, MCP, web and tests read it).

Stored in ``profiles.studio_prefs["persona"]`` (an existing JSONB column: no migration). It also learns: what the
founder saves, approves and asks to fix moves the defaults (``persona_learned``, see "learning" below).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any, Literal, get_args

PersonaId = Literal["founder", "creator", "indie_dev", "agency", "educator"]
PERSONA_IDS: tuple[str, ...] = get_args(PersonaId)
DEFAULT: PersonaId = "founder"
# Burned-in caption presets the kit knows (plugin/kit/lib/captions.mjs PRESET_WORDS).
CAPTION_PRESETS = ("beast-mode", "billboard", "sideline", "butter-serif")


@dataclass(frozen=True)
class Persona:
    id: PersonaId
    label: str
    blurb: str  # one line under the choice, in the founder's words
    recipe: str  # the runnable recipe to start from (`studio init --recipe`)
    also: tuple[str, ...]  # other recipes that fit
    ratios: tuple[str, ...]  # first one is the main cut
    length_s: tuple[int, int]  # suggested range, seconds
    shot_s: tuple[float, float]  # average seconds per shot (pacing)
    pacing: str
    hook: str
    tone: str
    captions: str  # one of CAPTION_PRESETS
    caption_note: str
    style: str
    sound: str
    ending: str

    @property
    def ratio(self) -> str:
        return self.ratios[0]

    def defaults(self) -> dict[str, Any]:
        """What the AI should suggest, as data (also what `get_founder_context` returns)."""
        out = asdict(self)
        out["ratio"] = self.ratio
        out["ratios"] = list(self.ratios)
        out["also"] = list(self.also)
        out["length_s"] = list(self.length_s)
        out["shot_s"] = list(self.shot_s)
        out["playbook"] = "personas"
        return out


PERSONAS: dict[str, Persona] = {
    p.id: p
    for p in (
        Persona(
            id="founder",
            label="Founder",
            blurb="I'm building a product and need launch and feature videos.",
            recipe="saas-launch-32",
            also=("explainer-30", "changelog-30", "data-story-20"),
            ratios=("16:9", "1:1"),
            length_s=(20, 35),
            shot_s=(2.0, 3.0),
            pacing="Medium: a new shot every 2–3 s; hold the proof shot longer so it can be read.",
            hook="The customer's pain in their own words (from the validation), then real proof on screen.",
            tone="Credible and specific: real numbers, real screens, no hype words.",
            captions="sideline",
            caption_note="Short lines (about 6 words) low in the frame, so the product stays visible.",
            style="living-ui",
            sound="A calm bed or none; the film must work muted.",
            ending="Product name and URL for 2 s.",
        ),
        Persona(
            id="creator",
            label="Content creator",
            blurb="I post short videos for my audience on Reels, Shorts and TikTok.",
            recipe="vertical-feature-15",
            also=("explainer-30", "kinetic-lyric-60"),
            ratios=("9:16",),
            length_s=(10, 30),
            shot_s=(1.0, 1.5),
            pacing="Fast: a cut every 1–1.5 s, on the beat; no shot sits still for more than 2 s.",
            hook="A pattern break in the first second: a surprising line, a bold claim they can back, or 'you' talk.",
            tone="Personal and energetic; spoken, first person, like talking to one viewer.",
            captions="beast-mode",
            caption_note="Big, word-by-word captions in the centre safe area, 2–3 words at a time.",
            style="vertical-captions",
            sound="Music with a clear beat; cuts land on beats, the big moment on a downbeat.",
            ending="A loop back to the first frame, or a one-line ask (follow, comment).",
        ),
        Persona(
            id="indie_dev",
            label="Indie hacker / developer",
            blurb="I ship tools and side projects and share them with other builders.",
            recipe="repo-promo-20",
            also=("changelog-30", "saas-launch-32"),
            ratios=("16:9", "9:16"),
            length_s=(15, 30),
            shot_s=(1.5, 2.5),
            pacing="Medium-fast: show, don't tell; one idea per shot, 1.5–2.5 s each.",
            hook="It working in frame one: the terminal command or the product doing the thing.",
            tone="Dry and honest, builder to builder; numbers only if they are true (stars, users, ms).",
            captions="billboard",
            caption_note="Few words (about 3) as titles over the screen; code stays readable.",
            style="dark-keynote",
            sound="Light: typing and UI sounds, a soft bed or silence.",
            ending="Repo or site URL, plus the install command if there is one.",
        ),
        Persona(
            id="agency",
            label="Agency / marketer",
            blurb="I make marketing videos for clients or for the brand I work for.",
            recipe="vertical-feature-15",
            also=("brand-film-18", "showreel-15", "saas-launch-32"),
            ratios=("9:16", "1:1", "16:9"),
            length_s=(15, 20),
            shot_s=(1.0, 2.0),
            pacing="Fast and polished: a cut every 1–2 s, exact timing, nothing left loose.",
            hook="The client's benefit in 3 words, on brand from the first frame.",
            tone="Polished and on brand: the client's colours, fonts and words, never ours.",
            captions="billboard",
            caption_note="Short title captions (about 3 words) in the brand font; one cut per platform ratio.",
            style="swiss-kinetic",
            sound="A licensed track cut to length; logo on the last downbeat.",
            ending="Logo and one call to action; the same ending on every ratio.",
        ),
        Persona(
            id="educator",
            label="Educator / coach",
            blurb="I teach: courses, tutorials, coaching, tips.",
            recipe="explainer-30",
            also=("data-story-20", "vertical-feature-15"),
            ratios=("16:9", "9:16"),
            length_s=(30, 60),
            shot_s=(3.0, 4.0),
            pacing="Calm: 3–4 s per shot so every step can be read; one idea per scene.",
            hook="A question the viewer has, or 'the mistake most people make'.",
            tone="Clear and patient; plain words, numbered steps, one example.",
            captions="sideline",
            caption_note="Full sentences (about 6–7 words a line) so the lesson works muted.",
            style="flat-explainer",
            sound="Voiceover first; a quiet bed under it.",
            ending="What to do next (try it, the course link) in one line.",
        ),
    )
}


def get(persona_id: str | None) -> Persona | None:
    return PERSONAS.get((persona_id or "").strip().lower())


def choices() -> list[dict[str, str]]:
    """The "Who are you?" options, in the order to show them."""
    return [{"id": p.id, "label": p.label, "blurb": p.blurb} for p in PERSONAS.values()]


def context(persona_id: str | None, learned: dict[str, Any] | None = None) -> dict[str, Any]:
    """The persona block for `get_founder_context`: the defaults (adapted to how the founder actually works), or
    how to ask when none is saved yet."""
    persona = get(persona_id)
    if persona is None:
        return {
            "persona": None,
            "persona_hint": (
                "Not asked yet. Before planning a video, ask the founder once 'Who are you?' with these choices, "
                "then save the answer with set_persona. Until then use the founder defaults."
            ),
            "persona_choices": choices(),
        }
    adapted, notes = adapt(persona, learned)
    out = adapted.defaults()
    out["learned"] = notes
    out["videos_seen"] = int((learned or {}).get("videos", 0))
    block: dict[str, Any] = {"persona": out}
    if (other := suggest(persona, learned)) is not None:
        block["persona_suggestion"] = {
            "id": other,
            "label": PERSONAS[other].label,
            "note": (
                f"What they make looks like a {PERSONAS[other].label.lower()}'s videos. Offer once, in one line, "
                f"to switch (set_persona); don't push."
            ),
        }
    return block


# --------------------------------------------------------------------------- learning (docs/18 §17.1)
#
# The persona the founder picked is a starting point. What they actually make, approve and ask to fix moves it:
# a saved video counts once, an approved one counts twice, and review notes ("too slow", "too long") nudge the
# pacing and length. Stored next to the persona in ``profiles.studio_prefs["persona_learned"]``, bounded in size.

LEARN_KEY = "persona_learned"
MIN_EVIDENCE = 3  # votes before a habit changes a default
_KEEP = 12  # recent numbers kept (lengths, shot lengths)
_TOP = 8  # values kept per counter
_FASTER = ("too slow", "faster", "speed up", "drags", "quicker", "boring", "lost interest")
_SLOWER = ("too fast", "slower", "slow down", "rushed", "can't read", "cannot read", "hard to read")
_SHORTER = ("too long", "shorter", "cut it down", "trim it")
_LONGER = ("too short", "longer", "more time")


def _count(counter: dict[str, Any] | None, key: str | None, weight: int) -> dict[str, int]:
    out = {k: int(v) for k, v in (counter or {}).items() if isinstance(v, int | float)}
    if key:
        out[key] = out.get(key, 0) + weight
    return dict(sorted(out.items(), key=lambda kv: -kv[1])[:_TOP])


def _recent(values: list[Any] | None, new: list[float]) -> list[float]:
    kept = [float(v) for v in (values or []) if isinstance(v, int | float)]
    return (kept + new)[-_KEEP:]


def _shots(film: dict[str, Any]) -> list[tuple[float, float]]:
    """(start, end) of each shot: clips for hand-built films, scenes for recipe films."""
    spans = film.get("clips") or film.get("scenes") or []
    out: list[tuple[float, float]] = []
    for s in spans if isinstance(spans, list) else []:
        start, end = (s.get("start"), s.get("end")) if isinstance(s, dict) else (None, None)
        if isinstance(start, int | float) and isinstance(end, int | float) and end > start:
            out.append((float(start), float(end)))
    return out


def observe_film(learned: dict[str, Any] | None, film: dict[str, Any], weight: int = 1) -> dict[str, Any]:
    """Fold one saved (weight 1) or approved (weight 2) video's manifest into what we've learned."""
    if film.get("kind", "video") != "video":
        return dict(learned or {})
    out = dict(learned or {})
    out["videos"] = int(out.get("videos", 0)) + 1
    ratios = out.get("ratios")
    formats = film.get("formats") or []
    for i, f in enumerate(formats if isinstance(formats, list) else []):
        if isinstance(f, dict) and isinstance(f.get("ratio"), str):
            ratios = _count(ratios, f["ratio"], weight + (1 if i == 0 else 0))  # the main cut counts a bit more
    out["ratios"] = _count(ratios, None, 0)
    for field, key in (("recipe", "recipes"), ("style", "styles")):
        value = film.get(field)
        out[key] = _count(out.get(key), value if isinstance(value, str) and value else None, weight)
    caption = film.get("captionStyle")
    preset = caption.get("preset") if isinstance(caption, dict) else None
    out["captions"] = _count(out.get("captions"), preset if preset in CAPTION_PRESETS else None, weight)
    duration = film.get("duration")
    length = float(duration) if isinstance(duration, int | float) and duration > 0 else 0.0
    out["lengths"] = _recent(out.get("lengths"), [length] * weight if length else [])
    shots = _shots(film)
    avg = sum(e - s for s, e in shots) / len(shots) if len(shots) >= 2 else 0.0
    out["shot_s"] = _recent(out.get("shot_s"), [round(avg, 2)] * weight if avg else [])
    return out


def observe_note(learned: dict[str, Any] | None, text: str, tags: list[str] | None = None) -> dict[str, Any]:
    """A founder's review note: "too slow" / "too long" style feedback nudges pacing and length."""
    low = f" {text.lower()} "
    out = dict(learned or {})
    pace = (1 if any(w in low for w in _FASTER) or "lost-interest" in (tags or []) else 0) - (
        1 if any(w in low for w in _SLOWER) else 0
    )
    length = (1 if any(w in low for w in _SHORTER) else 0) - (1 if any(w in low for w in _LONGER) else 0)
    if pace:
        out["faster"] = max(-6, min(6, int(out.get("faster", 0)) + pace))
    if length:
        out["shorter"] = max(-6, min(6, int(out.get("shorter", 0)) + length))
    return out


def _median(values: list[float]) -> float:
    s = sorted(values)
    mid = len(s) // 2
    return s[mid] if len(s) % 2 else (s[mid - 1] + s[mid]) / 2


def _habit(counter: Any) -> tuple[str, int] | None:
    """The clear favourite in a counter: at least MIN_EVIDENCE votes and ahead of the runner-up."""
    if not isinstance(counter, dict) or not counter:
        return None
    ranked = sorted(((k, int(v)) for k, v in counter.items()), key=lambda kv: -kv[1])
    top, votes = ranked[0]
    if votes < MIN_EVIDENCE or (len(ranked) > 1 and ranked[1][1] == votes):
        return None
    return top, votes


def adapt(persona: Persona, learned: dict[str, Any] | None) -> tuple[Persona, list[str]]:
    """The persona as this founder actually uses it, and a plain-English line for each thing that moved."""
    if not learned:
        return persona, []
    p = persona
    notes: list[str] = []
    if (h := _habit(learned.get("recipes"))) and h[0] != p.recipe:
        p = replace(p, recipe=h[0], also=tuple(x for x in (p.recipe, *p.also) if x != h[0]))
        notes.append(f"You keep choosing the {h[0]} format, so it is now the first suggestion.")
    if (h := _habit(learned.get("ratios"))) and h[0] != p.ratios[0]:
        p = replace(p, ratios=(h[0], *[r for r in p.ratios if r != h[0]])[:3])
        notes.append(f"Most of your videos are {h[0]}, so that is now the main cut.")
    if (h := _habit(learned.get("styles"))) and h[0] != p.style:
        p = replace(p, style=h[0])
        notes.append(f"You prefer the {h[0]} style.")
    if (h := _habit(learned.get("captions"))) and h[0] != p.captions:
        p = replace(p, captions=h[0], caption_note=f"{h[0]} captions: the preset you use most.")
        notes.append(f"Captions now default to {h[0]}, the preset you use most.")

    lengths = [v for v in learned.get("lengths") or [] if isinstance(v, int | float)]
    lo, hi = p.length_s
    if len(lengths) >= MIN_EVIDENCE:
        mid = _median(lengths)
        lo, hi = max(5, round(mid * 0.8)), min(180, max(round(mid * 1.2), round(mid * 0.8) + 1))
    shorter = int(learned.get("shorter", 0))
    if abs(shorter) >= 2:
        k = 1 - 0.1 * max(-4, min(4, shorter))
        lo, hi = max(5, round(lo * k)), min(180, max(round(hi * k), round(lo * k) + 1))
    if (lo, hi) != p.length_s:
        p = replace(p, length_s=(lo, hi))
        notes.append(f"Your videos run about {lo}–{hi} s, so that is the suggested length now.")

    shots = [v for v in learned.get("shot_s") or [] if isinstance(v, int | float)]
    a, b = p.shot_s
    if len(shots) >= MIN_EVIDENCE:
        mid = _median(shots)
        a, b = mid * 0.85, mid * 1.15
    faster = int(learned.get("faster", 0))
    if abs(faster) >= 2:
        k = 1 - 0.1 * max(-4, min(4, faster))
        a, b = a * k, b * k
    new_shot = (max(0.5, round(a * 2) / 2), max(0.5, round(b * 2) / 2))
    if new_shot[1] <= new_shot[0]:
        new_shot = (new_shot[0], new_shot[0] + 0.5)
    if new_shot != p.shot_s:
        word = "faster" if new_shot[0] < p.shot_s[0] else "slower" if new_shot[0] > p.shot_s[0] else "adjusted"
        p = replace(
            p,
            shot_s=new_shot,
            pacing=f"Learned from your videos and notes: a new shot every {new_shot[0]:g}–{new_shot[1]:g} s.",
        )
        notes.append(
            f"Pacing is {word} than the {persona.label.lower()} default: {new_shot[0]:g}–{new_shot[1]:g} s a shot."
        )
    return p, notes


def suggest(persona: Persona, learned: dict[str, Any] | None) -> str | None:
    """Another persona whose main recipe and ratio match what this founder keeps making, if it is clear."""
    if not learned or int(learned.get("videos", 0)) < MIN_EVIDENCE + 1:
        return None
    recipe, ratio = _habit(learned.get("recipes")), _habit(learned.get("ratios"))
    if recipe is None or ratio is None:
        return None
    if persona.recipe == recipe[0] and persona.ratio == ratio[0]:
        return None
    for other in PERSONAS.values():
        if other.id != persona.id and other.recipe == recipe[0] and other.ratio == ratio[0]:
            return other.id
    return None
