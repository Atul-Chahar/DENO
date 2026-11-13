// Runs inside ~/.deno-studio/deps: Kokoro TTS (Apache-2.0), local and free.
// argv: <json file: {phrases: [..], voice, out_dir}>
import fs from 'node:fs';
import path from 'node:path';
import { KokoroTTS } from 'kokoro-js';

const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
const result = [];
for (const [i, text] of job.phrases.entries()) {
  const audio = await tts.generate(text, { voice: job.voice || 'af_heart', speed: job.speed || 1 });
  const file = path.join(job.out_dir, `phrase-${String(i).padStart(3, '0')}.wav`);
  await audio.save(file);
  result.push({ file, rate: audio.sampling_rate, samples: audio.audio.length });
}
process.stdout.write(JSON.stringify(result));
