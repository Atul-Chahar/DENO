"""Social handles: what PATCH /me accepts, and what GET /me does with rows saved under older rules."""

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from deno_api.v1.me import _me_out, _stored_handles
from deno_api.v1.schemas import Handle, MeUpdate


@pytest.mark.parametrize(
    "raw",
    [
        ":\x00",  # the contract suite's case: two characters in, one left after cleaning
        "a\x7f",
        "\x00\x01",
        "é",  # NFC composes this to a single character
    ],
)
def test_a_handle_too_short_once_cleaned_is_rejected(raw: str) -> None:
    with pytest.raises(ValidationError):
        MeUpdate.model_validate({"handles": [{"platform": "x", "handle": raw}]})


@pytest.mark.parametrize("raw", ["ab", "@founder", "u/some_dev", "in/jane-doe-12345", "josé"])
def test_ordinary_handles_are_still_accepted(raw: str) -> None:
    assert Handle.model_validate({"platform": "x", "handle": raw}).handle == raw


def test_a_bad_stored_handle_is_left_out_instead_of_failing_the_profile() -> None:
    stored = [
        {"platform": "x", "handle": ":"},  # saved before the rule was enforced
        {"platform": "reddit", "handle": "u/some_dev"},
        {"platform": "myspace", "handle": "tom"},
        "not-a-dict",
    ]
    assert [(h.platform, h.handle) for h in _stored_handles(stored)] == [("reddit", "u/some_dev")]
    assert _stored_handles(None) == []


def test_the_profile_still_renders_with_a_bad_stored_handle() -> None:
    profile = SimpleNamespace(
        display_name=None,
        plan="free",
        role="user",
        product_name=None,
        product_url=None,
        timezone=None,
        founder_role=None,
        handles=[{"platform": "x", "handle": ":"}, {"platform": "hn", "handle": "pg"}],
        voice_preset=None,
        notification_prefs=None,
    )
    out = _me_out("00000000-0000-0000-0000-000000000001", None, profile)
    assert [h.handle for h in out.handles] == ["pg"]
