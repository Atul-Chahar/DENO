"""Several NIM keys: each run bound to one key with its own 40/min budget; the run line grows with them."""

from __future__ import annotations

import uuid

import fakeredis
from pydantic import SecretStr

from deno_core.settings import Settings
from deno_llm import factory
from deno_llm.limiter import NIM_KEY


def settings(primary: str = "k0", extra: str = "") -> Settings:
    return Settings(  # type: ignore[call-arg]
        _env_file=None,
        environment="test",
        nvidia_nim_api_key=SecretStr(primary),
        nvidia_nim_extra_api_keys=SecretStr(extra),
        run_queue_capacity=2,
    )


def test_keys_parse_dedupe_and_scale_the_line() -> None:
    assert settings().nim_keys() == ["k0"]
    s = settings(extra=" k1, ,k0,k2 ")
    assert s.nim_keys() == ["k0", "k1", "k2"]
    assert s.run_queue_slots == 6
    assert settings(primary="").run_queue_slots == 2  # no key at all: still one lane
    assert "k1" not in repr(s)  # secrets stay masked


def test_a_run_keeps_its_key_and_runs_spread_across_keys() -> None:
    keys = ["a", "b", "c"]
    run = str(uuid.uuid4())
    assert factory.pick_key(keys, run) == factory.pick_key(keys, run)  # hand-offs resume on the same key
    used = {factory.pick_key(keys, str(uuid.uuid4())) for _ in range(200)}
    assert used == {0, 1, 2}
    assert factory.pick_key(["only"], run) == 0


def test_build_stack_binds_the_key_and_its_own_budget() -> None:
    s = settings(extra="k1")
    seeds = {factory.pick_key(s.nim_keys(), f"run-{i}"): f"run-{i}" for i in range(50)}
    first = factory.build_stack(s, seed=seeds[0])
    second = factory.build_stack(s, seed=seeds[1])
    assert first.router._api_key == "k0" and second.router._api_key == "k1"

    a = factory.build_stack(s, fakeredis.FakeAsyncRedis(), seed=seeds[0])
    b = factory.build_stack(s, fakeredis.FakeAsyncRedis(), seed=seeds[1])
    assert a.limiter._key == NIM_KEY  # the original key keeps its existing budget key
    assert b.limiter._key == f"{NIM_KEY}:1"
