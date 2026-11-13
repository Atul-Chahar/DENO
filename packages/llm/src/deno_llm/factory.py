"""Wires the LLM layer from settings: one shared limiter for chat, embeddings and rerank."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass

from redis.asyncio import Redis

from deno_core.settings import Settings
from deno_llm.limiter import NIM_KEY, Limiter, LocalLimiter, ValkeyLimiter
from deno_llm.retrieval_models import NimEmbedder, NimReranker
from deno_llm.router import LLMRouter
from deno_llm.tracing import tracing_callbacks
from deno_llm.usage import UsageTracker


@dataclass
class LLMStack:
    router: LLMRouter
    embedder: NimEmbedder
    reranker: NimReranker
    usage: UsageTracker
    limiter: Limiter


def pick_key(keys: list[str], seed: str | None) -> int:
    """Which NIM key a run uses: stable per run (its hand-offs keep the same key), spread across keys."""
    if len(keys) <= 1:
        return 0
    if seed is None:
        return secrets.randbelow(len(keys))
    return int(hashlib.sha256(seed.encode()).hexdigest(), 16) % len(keys)


def build_stack(settings: Settings, redis: Redis | None = None, *, seed: str | None = None) -> LLMStack:
    """A fresh stack per run (its own ``UsageTracker`` budget); the limiter budget is shared via Valkey.

    With several NIM keys (``NVIDIA_NIM_EXTRA_API_KEYS``) each run is bound to one key (``seed`` = run id)
    and each key has its own shared 40/min budget."""
    rpm = settings.llm_requests_per_minute
    keys = settings.nim_keys() or [""]
    index = pick_key(keys, seed)
    limiter_key = NIM_KEY if index == 0 else f"{NIM_KEY}:{index}"
    limiter: Limiter = ValkeyLimiter(redis, rpm, key=limiter_key) if redis is not None else LocalLimiter(rpm)
    usage = UsageTracker(
        token_budget=settings.llm_run_token_budget,
        usd_per_mtok_input=settings.llm_usd_per_mtok_input,
        usd_per_mtok_output=settings.llm_usd_per_mtok_output,
    )
    key = keys[index]
    base = settings.nvidia_nim_base_url
    return LLMStack(
        router=LLMRouter(settings, limiter=limiter, callbacks=[usage, *tracing_callbacks(settings)], api_key=key),
        embedder=NimEmbedder(api_key=key, model=settings.embed_model, base_url=base, limiter=limiter),
        reranker=NimReranker(api_key=key, model=settings.rerank_model, base_url=base, limiter=limiter),
        usage=usage,
        limiter=limiter,
    )
