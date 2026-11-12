# Third-party notices

## petergyang/no-ai-slop

The anti-slop gate catalog (`packages/gates/src/deno_gates/rules.py`), the content rewrite and judge
prompts, and the Ban Risk Studio edit prompt adapt patterns, word lists and editing principles from
https://github.com/petergyang/no-ai-slop, used under the MIT License:

```
MIT License

Copyright (c) 2026 Peter Yang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Deno Studio kit (plugin/kit) — installed on the user's machine, not bundled

The kit downloads these on first use into `~/.deno-studio/deps`; none are redistributed in this repository.

| Component | Licence | Use |
|---|---|---|
| playwright-core (Microsoft) | Apache-2.0 | Drives headless Chromium to render frames |
| kokoro-js + Kokoro-82M ONNX weights (hexgrad / onnx-community) | Apache-2.0 | Local voiceover |
| @huggingface/transformers (transformers.js) | Apache-2.0 | Runs Whisper and Kokoro locally |
| Whisper "base" timestamped ONNX weights (OpenAI / onnx-community) | MIT | Local captions with word timings |
| ffmpeg (user-installed) | LGPL/GPL (the user's build) | Encoding and audio mixing; called as a separate program |

Ideas, not code: the Studio playbooks (packages/studio/content) are written in our own words from the research in
docs/13, which credits each source. Media found through `search_media` keeps its provider's licence (Pexels,
Pixabay, CC0 on Freesound, ISC Lucide icons, MIT Tabler icons); the kit records each asset's credit in the project's
`CREDITS.json` and Deno stores it with the version.
