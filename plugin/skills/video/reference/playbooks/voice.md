# Voiceover

_Write for the ear, generate with word times, fire visuals on cue words, keep keys out of the chat._

# Voiceover

- Write the script for the ear: short sentences, the founder's own words (voice profile), numbers only from their
  facts. Run it through `check_copy(kind="voiceover")` before generating.
- Mark visual hits with braces: `We cut onboarding from {nine} steps to {two}.` The kit turns `{word}` into a cue
  at the moment the word is spoken.
- `studio voice script.md` uses **Kokoro** (free, runs locally) by default. `--engine elevenlabs` or
  `--engine sarvam` use the founder's own key from `studio config`; the key never appears in the chat.
- Generate per phrase so one line can be re-recorded without touching the rest.
- Duck music under the voice; no voice over an emotional story film (let the picture carry it).
