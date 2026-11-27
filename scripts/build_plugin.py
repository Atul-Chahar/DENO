"""Build the Claude Code plugin's skills from the Studio's shared content (docs/18 §4.4).

The words live once, in packages/studio/src/deno_studio/content/. This writes plugin/skills/<name>/SKILL.md and
the offline reference copies, so the plugin and the MCP never drift, and web/lib/gallery/formats.json, so the
public video gallery (docs/23) shows the same formats and styles, and web/lib/personas.json, so the site's
"Who are you?" pages (docs/18 §17) show the defaults the AI follows. CI runs it with --check.

    uv run python scripts/build_plugin.py          # write
    uv run python scripts/build_plugin.py --check  # fail if plugin/skills is stale
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from deno_studio import list_docs, personas

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "plugin" / "skills"
GALLERY = ROOT / "web" / "lib" / "gallery" / "formats.json"
RUNNABLE = ROOT / "plugin" / "kit" / "template" / "recipes"
PERSONAS = ROOT / "web" / "lib" / "personas.json"

PREAMBLE = """> **Deno Studio plugin.** `studio` is this plugin's command (on your PATH while the plugin is enabled; if the
> shell can't find it, use `node "${CLAUDE_PLUGIN_ROOT}/kit/cli.mjs"`). Deno's MCP tools (get_founder_context,
> get_playbook, search_media, check_copy, save_video, get_review_notes, …) come from the `deno` server this plugin
> adds; approve the sign-in when Claude Code asks. Prefer `get_playbook` (it leaves out rules the founder switched
> off); offline copies are in `${CLAUDE_PLUGIN_ROOT}/skills/video/reference/`.
>
> **Talking to the founder:** you are their creative director. Warm, brief, plain words about the story and the
> viewer. Keep the machinery out of chat (no command or tool names, ids, paths, JSON or render times unless they
> asked for a file or must act on one). One or two sentences after each change. Playbook: `conversation`.
"""


def _prose(body: str) -> str:
    """A doc's body without its own `# Title` line (the page prints the title itself)."""
    lines = body.strip().splitlines()
    if lines and lines[0].startswith("# "):
        lines = lines[1:]
    return "\n".join(lines).strip()


def gallery_formats() -> str:
    """Recipes and styles as data for the website's video gallery."""
    recipes = [
        {
            "slug": d.slug,
            "title": d.title,
            "summary": d.summary,
            "tags": list(d.tags),
            "ratio": d.meta.get("ratio", ""),
            "seconds": int(d.meta["length"]) if d.meta.get("length", "").isdigit() else None,
            "style": d.meta.get("style", ""),
            # The kit ships this recipe as a film that already renders (`studio init --recipe <slug>`).
            "runnable": (RUNNABLE / f"{d.slug}.json").exists(),
            "body": _prose(d.body),
        }
        for d in list_docs("recipes")
    ]
    styles = [
        {
            "slug": d.slug,
            "title": d.title,
            "summary": d.summary,
            "tags": list(d.tags),
            "best_for": d.meta.get("best_for", ""),
            "avoid_for": d.meta.get("avoid_for", ""),
        }
        for d in list_docs("styles")
    ]
    return json.dumps({"recipes": recipes, "styles": styles}, indent=2, ensure_ascii=False) + "\n"


def persona_data() -> str:
    """The creator personas as data for the website (docs/18 §17), so the site shows what the AI follows."""
    rows = [{k: v for k, v in p.defaults().items() if k != "playbook"} for p in personas.PERSONAS.values()]
    return json.dumps({"default": personas.DEFAULT, "personas": rows}, indent=2, ensure_ascii=False) + "\n"


def skill_files() -> dict[Path, str]:
    out: dict[Path, str] = {}
    for doc in list_docs("skills"):
        head = f"---\nname: {doc.slug}\ndescription: {doc.summary}\n---\n\n"
        out[SKILLS / doc.slug / "SKILL.md"] = head + PREAMBLE + "\n" + doc.body
    for kind in ("playbooks", "styles", "recipes"):
        for doc in list_docs(kind):  # type: ignore[arg-type]
            out[SKILLS / "video" / "reference" / kind / f"{doc.slug}.md"] = (
                f"# {doc.title}\n\n_{doc.summary}_\n\n{doc.body}"
            )
    out[GALLERY] = gallery_formats()
    out[PERSONAS] = persona_data()
    return out


def main() -> int:
    check = "--check" in sys.argv
    want = skill_files()
    stale = [p for p, text in want.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
    extra = [p for p in SKILLS.rglob("*.md") if p not in want]
    if check:
        for p in stale + extra:
            print(f"stale: {p.relative_to(ROOT)}")
        if stale or extra:
            print("Run: uv run python scripts/build_plugin.py")
            return 1
        print(f"plugin skills up to date ({len(want)} files)")
        return 0
    for p in extra:
        p.unlink()
    for p, text in want.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8", newline="\n")  # LF on Windows too
    print(f"wrote {len(want)} files under {SKILLS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
