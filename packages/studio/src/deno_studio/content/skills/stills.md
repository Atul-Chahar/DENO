---
name: stills
description: Design posters, LinkedIn/Instagram carousels, OG images and YouTube thumbnails from the founder's validated pains and brand kit, rendered locally and saved to Deno. Use when the founder asks for an image, carousel, poster, banner or thumbnail.
---
# Stills
1. `get_founder_context`, `get_playbook("stills")`, `search_recipes("carousel")`, `get_style`.
2. `studio init <name> --still --size 1080x1350 --pages 8 --style <style> --idea <idea_id>`.
3. Write every page's copy first; `check_copy(kind="on_screen")` on all of it.
4. Build: `window.PAGES` and `seek(p)` paint page `p`. Stock images via `search_media kind=image` + `studio fetch`.
5. `studio still` (PNGs) and `studio still --pdf` (carousel). Look at every page (`studio sheet`).
6. `studio upload --idea <idea_id>` (it sends the pages; the first page is the cover); share the link.
