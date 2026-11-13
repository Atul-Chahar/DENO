"""Which asset licences may go into a final video, and which need a visible credit (docs/13 §10, docs/18 §6)."""

from __future__ import annotations

from dataclasses import dataclass

# licence id -> (commercial use allowed, credit required, plain-English note)
_TABLE: dict[str, tuple[bool, bool, str]] = {
    "cc0": (True, False, "public domain"),
    "pexels": (True, False, "Pexels licence: free to use; crediting the creator is appreciated"),
    "pixabay": (True, False, "Pixabay content licence: free to use"),
    "own": (True, False, "the founder's own material"),
    "synth": (True, False, "synthesized by the studio kit"),
    "kit": (True, False, "part of the studio kit"),
    "ofl": (True, False, "SIL Open Font Licence"),
    "mit": (True, True, "MIT: keep the copyright notice"),
    "isc": (True, True, "ISC: keep the copyright notice"),
    "apache-2.0": (True, True, "Apache 2.0: keep the notice"),
    "cc-by": (True, True, "CC BY: credit the author"),
    "licensed": (True, False, "licensed through a sublicensing provider"),
    "generated": (True, False, "generated on the founder's key; check the provider's terms"),
    "archive-pd": (
        True,
        False,
        "public domain as claimed by the Internet Archive uploader: check it isn't someone else's show or song",
    ),
    "cc-by-sa": (True, True, "CC BY-SA: credit and share alike; avoid for marketing"),
    "cc-by-nc": (False, True, "non-commercial only: not allowed in marketing"),
    "cc-by-nd": (False, True, "no derivatives: can't be edited into a video"),
    "unknown": (False, False, "no licence recorded"),
}
WARN_ONLY = {"generated", "cc-by-sa", "archive-pd"}


@dataclass(frozen=True)
class LicenceCheck:
    licence: str
    commercial: bool
    credit_required: bool
    note: str
    warn: bool


def normalise(licence: str | None) -> str:
    raw = (licence or "unknown").strip().lower().replace("_", "-").replace(" ", "-")
    aliases = {
        "creative-commons-0": "cc0",
        "public-domain": "cc0",
        "pd": "cc0",
        "attribution": "cc-by",
        "cc-by-4.0": "cc-by",
        "cc-by-3.0": "cc-by",
        "attribution-noncommercial": "cc-by-nc",
        "cc-by-nc-4.0": "cc-by-nc",
        "cc-by-nc-3.0": "cc-by-nc",
        "apache": "apache-2.0",
        "synthesized": "synth",
    }
    return aliases.get(raw, raw if raw in _TABLE else "unknown")


def check(licence: str | None) -> LicenceCheck:
    key = normalise(licence)
    commercial, credit, note = _TABLE[key]
    return LicenceCheck(key, commercial, credit, note, key in WARN_ONLY)
