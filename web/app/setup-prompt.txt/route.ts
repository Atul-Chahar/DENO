import { SETUP_PROMPT } from '@/lib/site';

/** The one-paste setup prompt as plain text, so an agent can fetch it. */
export function GET() {
  return new Response(`${SETUP_PROMPT}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
