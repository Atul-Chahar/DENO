# Creator personas

_Who the founder is sets the defaults for every video: recipe, ratio, length, pacing, hook, tone, captions and style. Ask once, then follow it._

# Creator personas

`get_founder_context` returns `persona`: the founder's answer to "Who are you?" with its defaults (recipe, ratios,
length, seconds per shot, hook, tone, caption preset, style, sound, ending). Use it as your suggested answer to
every pre-production question. What the founder asks for in this conversation always wins over the persona.

## Ask once
- If `persona` is null, ask before you plan anything, in one short message: "Who are you?" with the five choices
  below (one line each). Recommend one if the context makes it obvious (a GitHub URL suggests indie hacker).
- Save the answer with `set_persona`. Never ask again; they can change it on the Account page or by telling you.
- If they skip it, use the founder defaults and don't save anything.

## It learns
- The persona is a starting point. Every video the founder saves counts once and every video they approve counts
  twice: the recipe, ratio, style and caption preset they keep choosing become the new defaults (after 3 votes),
  and their typical length and shot length replace the persona's.
- Review notes move it too: "too slow", "drags" or "lost interest" make the pacing faster; "rushed" or "can't read"
  make it slower; "too long" or "too short" move the length.
- `persona.learned` lists what moved, in plain words. Mention it once when it matters ("You usually go vertical, so
  I've planned 9:16 first"), never as a report.
- `persona_suggestion`: what they make looks like another persona. Offer the switch once, in one line; don't push.

## Founder
- Start from `saas-launch-32`; `explainer-30` for a new audience, `changelog-30` for updates.
- 16:9 main cut (X, LinkedIn, landing page), 1:1 for feeds. 20–35 s.
- Medium pacing: a new shot every 2–3 s; hold the proof shot long enough to read.
- Hook: the customer's pain in their own words from the validation, then proof on a real screen.
- Tone: credible and specific. Real numbers and real screens; no hype words.
- Captions `sideline`: short lines low in the frame so the product stays visible.
- Ending: product name and URL for 2 s.

## Content creator
- Start from `vertical-feature-15`. 9:16 only (Reels, Shorts, TikTok). 10–30 s.
- Fast pacing: a cut every 1–1.5 s, on the beat; no shot sits still for more than 2 s.
- Hook in the first second: a pattern break, a bold line they can back, or talk straight to "you".
- Tone: personal and energetic, first person, spoken, like talking to one viewer.
- Captions `beast-mode`: big, 2–3 words at a time, centre safe area, every spoken word.
- Sound: music with a clear beat; the big moment on a downbeat. Ending: loop to the first frame or one ask.

## Indie hacker / developer
- Start from `repo-promo-20`; `changelog-30` for releases. 16:9 main cut, 9:16 for Shorts. 15–30 s.
- Medium-fast pacing: one idea per shot, 1.5–2.5 s each. Show, don't tell.
- Hook: it working in frame one, the terminal command or the product doing the thing.
- Tone: dry and honest, builder to builder. Stars, users and timings only if true.
- Captions `billboard`: about 3 words as titles; code must stay readable behind them.
- Ending: repo or site URL, and the install command if there is one.

## Agency / marketer
- Start from `vertical-feature-15`; `brand-film-18` or `showreel-15` for brand pieces.
- One cut per platform: 9:16, 1:1 and 16:9 (`studio init --ratio 9:16,1:1,16:9`). 15–20 s.
- Fast and polished: a cut every 1–2 s, exact timing, nothing loose.
- Hook: the client's benefit in 3 words, on brand from frame one.
- Tone: the client's brand, colours, fonts and words, never ours. Set the brand kit from the client's site.
- Captions `billboard` in the brand font. Ending: logo and one call to action, the same on every ratio.

## Educator / coach
- Start from `explainer-30`; `data-story-20` when a number is the lesson. 16:9 main cut, 9:16 for tips. 30–60 s.
- Calm pacing: 3–4 s per shot so each step can be read; one idea per scene.
- Hook: a question the viewer has, or "the mistake most people make".
- Tone: clear and patient. Plain words, numbered steps, one worked example.
- Captions `sideline`: full sentences, so the lesson works muted. Voiceover first, a quiet bed under it.
- Ending: what to do next, in one line.
