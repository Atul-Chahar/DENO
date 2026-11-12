---
name: posts
description: Plan a week of founder-led posts for LinkedIn, Reddit or X from the validated idea, write them in the founder's voice, and save them through Deno's anti-slop gates to the Deno calendar. Use when the founder asks for posts, a content plan or a content calendar.
---

> **Deno Studio plugin.** `studio` is this plugin's command (on your PATH while the plugin is enabled; if the
> shell can't find it, use `node "${CLAUDE_PLUGIN_ROOT}/kit/cli.mjs"`). Deno's MCP tools (get_founder_context,
> get_playbook, search_media, check_copy, save_video, get_review_notes, …) come from the `deno` server this plugin
> adds; approve the sign-in when Claude Code asks. Prefer `get_playbook` (it leaves out rules the founder switched
> off); offline copies are in `${CLAUDE_PLUGIN_ROOT}/skills/video/reference/`.

# Posts through Deno
1. `get_founder_context(idea_id)`: pains with sources, ICP words, Story Bank, voice.
2. Plan: 5–14 briefs, each `{day, platform, angle, hook, is_promotional, story_id?}`. At most 1 in 5 promotional.
   Every first-person story must come from the Story Bank (pass its `story_id`).
3. `create_content_plan(idea_id, briefs)`. It lands in the founder's calendar.
4. For each brief, write the post and call `save_draft(brief_id, text)`. Read the gate report: if it fails, fix
   exactly the quoted lines and save again (new version). Don't argue with the gates; they are what keeps the
   founder's accounts safe.
5. `check_copy` is the dry run (nothing saved) for trying lines.
6. Tell the founder which drafts passed and link the calendar.
