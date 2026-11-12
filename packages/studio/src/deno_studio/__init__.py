"""Deno Studio (docs/18): the know-how and the server-side checks behind video, stills and posts made by the
founder's own AI. Playbooks, styles, recipes and skill texts live in ``content/`` and are served by the MCP and
copied into the Claude Code plugin, so both read the same words."""

from deno_studio.library import Doc, get_doc, list_docs, search_docs

__all__ = ["Doc", "get_doc", "list_docs", "search_docs"]
