"""Optional cleaned-text fields enforce their limits on what the client sent, as the OpenAPI schema says.

Schemathesis found POST /projects accepting a 65-character author_handle: on an optional field the length
check ran after control characters were stripped. The stored value was fine, the contract wasn't."""

import pytest
from pydantic import ValidationError

from deno_api.v1.schemas import ProjectCreate, ProjectPatch


def test_a_raw_value_over_the_limit_is_rejected_even_if_cleaning_would_shorten_it() -> None:
    with pytest.raises(ValidationError):
        ProjectCreate(idea="a valid idea here", author_handle="a" * 64 + "\x03")
    with pytest.raises(ValidationError):
        ProjectPatch(title="t" * 200 + "\x00")


def test_values_within_the_limit_are_still_cleaned() -> None:
    assert ProjectCreate(idea="a valid idea here", author_handle="\x03ab").author_handle == "ab"
    assert ProjectCreate(idea="a valid idea here", author_handle=None).author_handle is None
