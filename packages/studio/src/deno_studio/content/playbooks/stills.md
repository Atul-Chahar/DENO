---
title: Stills: posters, carousels, thumbnails
summary: The same engine renders single frames and multi-page carousels; one idea per page, big type, real facts.
tags: [stills, carousel, poster, thumbnail, images]
---
# Stills

The page exposes `window.PAGES` (number of pages) and `seek(p)` paints page `p` (0-based). `studio still` renders
PNGs, and `--pdf` joins them into a carousel PDF.

- **Carousel (LinkedIn, Instagram):** 1080×1350, 6–10 pages. Page 1 is the hook (the pain in the ICP's words),
  one idea per page, the last page is the ask. Big type (headline ≥ 7% of page height).
- **Poster / OG image:** 1200×630 (OG) or 1080×1350. One message, the product, the brand accent.
- **Thumbnail:** 1280×720. A face or the product, three words at most, high contrast.
- Every word goes through `check_copy(kind="on_screen")`. Save with `studio upload --still`.
