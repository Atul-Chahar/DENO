/** The MCP server's tools and prompts, mirrored from apps/api/src/deno_api/mcp_server.py. Keep in sync. */

export interface ToolDoc {
  name: string;
  title: string;
  group: 'Ideas and validation' | 'Posts' | 'Studio: rules and looks' | 'Studio: media and saving' | 'Studio: review';
  writes: boolean;
  args: string;
  does: string;
}

export const TOOLS: ToolDoc[] = [
  { name: 'list_ideas', title: 'List my ideas', group: 'Ideas and validation', writes: false, args: 'limit (default 20)', does: 'Your ideas, newest first, each with its latest validation: status, verdict and confidence.' },
  { name: 'validate_idea', title: 'Validate an idea', group: 'Ideas and validation', writes: true, args: 'idea (a few sentences; may include a website or GitHub URL)', does: 'Starts a validation. Deno collects public evidence and computes a verdict in about 3 to 4 minutes. Returns a run_id to poll. Counts toward your monthly validations.' },
  { name: 'get_validation', title: 'Check a validation', group: 'Ideas and validation', writes: false, args: 'run_id', does: 'Progress of a validation: queued (with your place in the line), running, awaiting_review (done), succeeded, failed or cancelled.' },
  { name: 'get_report', title: 'Read a validation report', group: 'Ideas and validation', writes: false, args: 'run_id, max_claims (default 30)', does: 'The verdict (build, pivot, kill or insufficient evidence), confidence, signals and the verified claims, each with the public URL that supports it.' },
  { name: 'get_founder_context', title: 'Founder context for content', group: 'Posts', writes: false, args: 'idea_id', does: 'Everything Deno knows for making your content: the idea and verdict, the strongest evidenced pains with quotes and sources, your Story Bank, voice samples, brand kit and taste (what you asked to fix before).' },
  { name: 'check_copy', title: "Check copy against Deno's gates", group: 'Posts', writes: false, args: 'text, kind (post | on_screen | captions | voiceover), platform (linkedin | reddit | x | hn), idea_id (optional)', does: 'Runs the anti-slop gates on text without saving it: AI tells, invented numbers, ban risks, and words-per-screen limits for video copy. With idea_id, numbers from your evidence and Story Bank are allowed.' },
  { name: 'create_content_plan', title: 'Create a content plan', group: 'Posts', writes: true, args: 'idea_id, briefs (1 to 30 items: day, platform, angle, hook, is_promotional, story_id)', does: 'Puts a plan your AI wrote into your Deno calendar and returns the brief ids. Counts as one content plan on your monthly quota.' },
  { name: 'list_briefs', title: 'List planned posts', group: 'Posts', writes: false, args: 'idea_id', does: "The idea's content plans with every brief and the state of its latest draft: none, needs work, passed the gates or approved." },
  { name: 'save_draft', title: 'Save a post draft', group: 'Posts', writes: true, args: 'brief_id, text, first_comment (optional)', does: 'Saves a post as a new draft version. Deno runs its gates and a quality score. A draft that fails is saved as "needs work" with the exact lines to fix.' },
  { name: 'get_playbook', title: 'Read a Studio playbook', group: 'Studio: rules and looks', writes: false, args: 'topic (default "index")', does: "Deno Studio's written rules for video and images that don't look AI-made: contract, preproduction, timing, motion, typography, style, sound, captions, voice, review, delivery, platforms, stills and more. Rules you struck in your Rulebook are left out." },
  { name: 'list_styles', title: 'List Studio styles', group: 'Studio: rules and looks', writes: false, args: 'name (optional)', does: 'The named visual styles with their rules and avoid-list. Without a name you get the list; with a name, that style\'s full guide.' },
  { name: 'search_recipes', title: 'Find a format recipe', group: 'Studio: rules and looks', writes: false, args: 'query, ratio (9:16 | 16:9 | 1:1 | 4:5)', does: 'Proven formats with timing tables: 15 s showreel, 30 s explainer, UI loop, changelog, carousel and others.' },
  { name: 'set_brand_kit', title: 'Set the brand kit', group: 'Studio: rules and looks', writes: true, args: 'idea_id, url (optional), colors, fonts, logo_url', does: "Reads colours, fonts and logo from your product's website, or sets them by hand. Stored on the idea; every video and image uses it." },
  { name: 'search_media', title: 'Search licensed media', group: 'Studio: media and saving', writes: false, args: 'kind (video | image | sfx | music | icon), query, orientation, max_duration, limit', does: 'Stock footage and photos, CC0 sound effects and music loops, and icons, each with its licence and credit. Works with no API keys.' },
  { name: 'create_upload', title: 'Get an upload URL', group: 'Studio: media and saving', writes: true, args: 'kind (poster | sheet | page | captions | review | source), ext, size', does: 'A signed URL to upload one file. By default only the light files go up: a poster and a contact sheet. The MP4s stay on your disk. The studio kit does this for you.' },
  { name: 'save_video', title: 'Save a video or image version', group: 'Studio: media and saving', writes: true, args: 'idea_id, manifest (film.json), files, item_id, brief_id, title, summary, final', does: "Saves a rendered video or still to your Deno Studio and returns the review link and Deno's checks: reading time, words per screen, licences and copy gates. final=true refuses assets without a commercial licence or credit." },
  { name: 'list_studio', title: 'List Studio videos and images', group: 'Studio: review', writes: false, args: 'idea_id (optional)', does: 'Your saved videos and stills, newest first, with status and open-note counts.' },
  { name: 'get_review_notes', title: 'Read review notes', group: 'Studio: review', writes: false, args: 'item_id, include_closed (default false)', does: 'Your notes on a video or still, each pinned to a version, frame and time, with the clip and chapter that were on screen. Notes by "system" are Deno\'s automated checks.' },
  { name: 'reply_note', title: 'Answer a review note', group: 'Studio: review', writes: true, args: 'note_id, status (fixed | wontfix | open), reply', does: "Marks a note fixed or won't fix, with a one-line reply you see under your note." },
];

export interface PromptDoc {
  name: string;
  title: string;
  args: string;
  does: string;
}

export const PROMPTS: PromptDoc[] = [
  { name: 'launch_video', title: 'Launch video', args: 'idea, length_s (20), ratio (16:9)', does: 'Plan and make a launch film for a validated idea.' },
  { name: 'reel', title: 'Vertical reel', args: 'topic, length_s (15)', does: 'A 9:16 reel for Reels, Shorts and TikTok, with burned-in captions.' },
  { name: 'explainer', title: 'Explainer with voiceover', args: 'idea, length_s (30)', does: 'A narrated explainer: the problem, what the product is, three steps, proof, the name.' },
  { name: 'carousel', title: 'LinkedIn carousel', args: 'topic, pages (8)', does: 'An image carousel made from the pains your validation found.' },
  { name: 'content_week', title: 'Content week', args: 'idea, platforms (linkedin, x)', does: "A week of posts in your voice, saved through Deno's gates." },
];
