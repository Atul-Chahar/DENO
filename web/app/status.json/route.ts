import { MCP_URL } from '@/lib/site';

/** The site footer's status dot: is the Deno API (and its database and Redis) answering? Cached for a minute. */
export const revalidate = 60;

const READYZ = MCP_URL.replace(/\/mcp$/, '/readyz');

export async function GET() {
  let ok = false;
  try {
    const res = await fetch(READYZ, { signal: AbortSignal.timeout(4000), next: { revalidate: 60 } });
    const body = (await res.json()) as { status?: string };
    ok = res.ok && body.status === 'ok';
  } catch {
    ok = false;
  }
  return Response.json({ ok }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
}
