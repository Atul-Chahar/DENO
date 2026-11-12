"""The FastAPI app as Vercel's Python function entrypoint."""

from deno_api.main import app

__all__ = ["app"]
