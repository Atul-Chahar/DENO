"""Registers the graph-runs Vercel Queues subscriber (importing it runs @subscribe)."""

from deno_worker.queue import run_graph

__all__ = ["run_graph"]
