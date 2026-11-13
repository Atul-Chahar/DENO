# Rendering and delivery

_Half-resolution drafts, multi-format finals, a master plus upload copies, poster, contact sheet and credits._

# Rendering and delivery

- Draft at half resolution (`studio render --draft`), final at full size.
- One film, several formats: lay out for every ratio in `film.json.formats` (read `window.FORMAT` in `seek`).
  `studio render --formats 9:16,1:1,16:9`.
- Output per format: H.264 yuv420p, BT.709 tags, `+faststart`; a CRF 16 master, a platform upload copy, a 720p
  review copy under 15 MB, a poster frame and a contact sheet.
- No animated grain; it falls apart in platform re-encodes.
- `studio upload` sends only the poster, the contact sheet (as JPEGs, about 250 KB together) and `film.json` to
  Deno. The master and the review copy stay on the founder's machine (`out/`). The founder reviews by scrubbing
  the contact sheet on Deno; for a playable copy, put an unlisted link (YouTube, R2, a tunnel) in with
  `studio upload --video-url https://…`. `--with-video` also uploads the 720p review copy (uses storage).
- Report: the file paths, what you decided and why, the two weakest moments, and any claim you couldn't verify.
