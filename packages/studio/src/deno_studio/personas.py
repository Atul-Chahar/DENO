"""Creator personas (docs/18 §17): "Who are you?" asked once, answered once, followed by every video skill.

A persona turns into concrete defaults: a runnable recipe, the ratio(s), a length, the pacing (seconds per shot),
the hook style, the tone, the caption preset and a style. The founder's own request always wins; these are the
answers the AI suggests when they say "use your defaults". The words behind each one live in the ``personas``
playbook; this module is the single source for the ids and numbers (API, MCP, web and tests read it).

Stored in ``profiles.studio_prefs["persona"]`` (an existing JSONB column: no migration).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
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


def context(persona_id: str | None) -> dict[str, Any]:
    """The persona block for `get_founder_context`: the defaults, or how to ask when none is saved yet."""
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
    return {"persona": persona.defaults()}
