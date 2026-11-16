import { findDoc } from '@/lib/docs/content';
import { pageMarkdown } from '@/lib/docs/markdown';

/** One docs page as Markdown ("View as Markdown", and the links in /llms.txt). */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findDoc(slug.replace(/\.md$/, ''));
  if (!page) return new Response('Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(pageMarkdown(page), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
