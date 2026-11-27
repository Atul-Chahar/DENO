"""The persona is saved once in profiles.studio_prefs (no migration) and read back everywhere (docs/18 §17)."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from deno_api import studio_service as svc
from deno_api.v1.me import update_me
from deno_api.v1.schemas import MeUpdate
from deno_core.errors import InvalidInput


def _profile(**prefs: Any) -> SimpleNamespace:
    return SimpleNamespace(
        display_name=None,
        plan="free",
        role="user",
        product_name=None,
        product_url=None,
        timezone=None,
        founder_role=None,
        handles=[],
        voice_preset=None,
        notification_prefs={},
        quality_weights=None,
        quality_threshold=None,
        studio_prefs=dict(prefs),
    )


class _Scope:
    def __init__(self, profile: SimpleNamespace) -> None:
        self.profile = profile
        self.user_id = "00000000-0000-0000-0000-000000000001"

        async def flush() -> None:
            return None

        self.session = SimpleNamespace(flush=flush)

    async def ensure_profile(self) -> SimpleNamespace:
        return self.profile


async def test_set_persona_keeps_other_studio_prefs() -> None:
    scope = _Scope(_profile(struck_rules=["timing.abc"]))
    out = await svc.set_persona(scope, "creator")  # type: ignore[arg-type]
    assert out["recipe"] == "vertical-feature-15" and out["ratio"] == "9:16"
    assert scope.profile.studio_prefs == {"struck_rules": ["timing.abc"], "persona": "creator"}
    assert svc.persona_of(scope.profile) == "creator"


async def test_set_persona_refuses_unknown() -> None:
    scope = _Scope(_profile())
    with pytest.raises(InvalidInput):
        await svc.set_persona(scope, "astronaut")  # type: ignore[arg-type]
    assert scope.profile.studio_prefs == {}


def test_persona_of_ignores_a_stale_value() -> None:
    assert svc.persona_of(_profile(persona="retired_id")) is None
    assert svc.persona_of(_profile()) is None
    assert svc.persona_of(SimpleNamespace()) is None


def test_me_update_accepts_only_known_personas() -> None:
    assert MeUpdate.model_validate({"persona": "indie_dev"}).persona == "indie_dev"
    assert MeUpdate.model_validate({"persona": None}).persona is None
    with pytest.raises(ValidationError):
        MeUpdate.model_validate({"persona": "astronaut"})


async def test_patch_me_saves_and_clears_the_persona() -> None:
    scope = _Scope(_profile(tags={"pacing": 2}))
    user = SimpleNamespace(email="f@example.com")
    out = await update_me(MeUpdate.model_validate({"persona": "educator"}), scope, user)  # type: ignore[arg-type]
    assert out.persona == "educator"
    assert scope.profile.studio_prefs == {"tags": {"pacing": 2}, "persona": "educator"}
    assert not hasattr(scope.profile, "persona")  # never written as a column

    out = await update_me(MeUpdate.model_validate({"persona": None}), scope, user)  # type: ignore[arg-type]
    assert out.persona is None
    assert scope.profile.studio_prefs == {"tags": {"pacing": 2}}


async def test_patch_me_without_persona_leaves_it() -> None:
    scope = _Scope(_profile(persona="agency"))
    user = SimpleNamespace(email=None)
    out = await update_me(MeUpdate.model_validate({"display_name": "Atul"}), scope, user)  # type: ignore[arg-type]
    assert out.persona == "agency"
