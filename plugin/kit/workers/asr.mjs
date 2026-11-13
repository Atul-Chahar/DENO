// Runs inside ~/.deno-studio/deps: Whisper (ONNX, transformers.js) with word timestamps.
// argv: <raw f32le 16 kHz mono file> <model id> <language or "">
import fs from 'node:fs';
import { pipeline } from '@huggingface/transformers';

const [, , raw, model, language] = process.argv;
const buf = fs.readFileSync(raw);
const pcm = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
const asr = await pipeline('automatic-speech-recognition', model, { dtype: 'q8' });
const out = await asr(pcm, {
  return_timestamps: 'word',
  chunk_length_s: 30,
  stride_length_s: 5,
  ...(language ? { language, task: 'transcribe' } : {}),
});
process.stdout.write(JSON.stringify({ text: out.text, chunks: out.chunks || [] }));
