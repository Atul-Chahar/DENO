import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { DocBlocks } from '@/components/docs/DocBlocks';
import { DOCS, GROUPS, docHref, findDoc, headingId } from '@/lib/docs/content';
import { pageMarkdown } from '@/lib/docs/markdown';
import { TOOLS } from '@/lib/docs/tools';

type Params = Promise<{ slug?: string[] }>;

function resolve(slug: string[] | undefined) {
  if (!slug || slug.length === 0) return findDoc('index');
  if (slug.length > 1 || slug[0] === 'index') return undefined;
  return findDoc(slug[0]);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = resolve((await params).slug);
  if (!page) return { title: 'Docs — Deno' };
  return { title: `${page.title} — Deno docs`, description: page.lead };
}

export default async function DocsPage({ params }: { params: Params }) {
  const page = resolve((await params).slug);
  if (!page) notFound();

  const index = DOCS.indexOf(page);
  const prev = DOCS[index - 1];
  const next = DOCS[index + 1];
  const toc =
    page.slug === 'tools'
      ? Array.from(new Set(TOOLS.map((t) => t.group)))
      : page.blocks.flatMap((b) => (b.t === 'h2' ? [b.text] : []));

  return (
    <>
      <header className="d-top">
        <div className="d-top__row">
          <a href="/" className="brand" aria-label="Deno home">
            <span className="brand__word">deno</span>
            <span className="brand__chip">DOCS</span>
          </a>
          <div className="d-top__links">
            <a href="/pricing">Pricing</a>
            <a href="/llms.txt" className="m-inline">llms.txt</a>
            <a href="/app/home" className="btn btn--lime btn--sm">Open dashboard</a>
          </div>
        </div>
      </header>

      <div className="d-layout">
        <nav className="d-nav" aria-label="Docs sections">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="d-nav__group">{group}</div>
              {DOCS.filter((d) => d.group === group).map((d) => (
                <a key={d.slug} href={docHref(d.slug)} aria-current={d.slug === page.slug ? 'page' : undefined}>{d.title}</a>
              ))}
            </div>
          ))}
          <div className="d-nav__group">For AI tools</div>
          <a href="/llms.txt" className="is-file">llms.txt</a>
          <a href="/llms-full.txt" className="is-file">llms-full.txt</a>
          <a href="/setup-prompt.txt" className="is-file">setup-prompt.txt</a>
        </nav>

        <main className="d-main">
          <article className="d-article">
            <div className="d-crumbs">
              <span className="m-mono">{page.group} / {page.title}</span>
              <div className="d-crumbs__tools">
                <CopyButton text={pageMarkdown(page)} label="Copy page for my AI" done="Copied as Markdown" />
                <a href={`/md/${page.slug}`} className="btn btn--sm btn--ghost">View as Markdown</a>
              </div>
            </div>
            <h1 className="display">{page.title}</h1>
            <p className="d-lead">{page.lead}</p>

            <DocBlocks blocks={page.blocks} />

            <div className="d-pager">
              {prev ? (
                <a href={docHref(prev.slug)} className="d-pager__link"><span>← PREVIOUS</span>{prev.title}</a>
              ) : <span />}
              {next && (
                <a href={docHref(next.slug)} className="d-pager__link d-pager__link--next"><span>NEXT →</span>{next.title}</a>
              )}
            </div>
          </article>
        </main>

        {toc.length > 0 && (
          <aside className="d-toc" aria-label="On this page">
            <span className="m-mono">On this page</span>
            {toc.map((h) => <a key={h} href={`#${headingId(h)}`}>{h}</a>)}
            <div className="d-toc__help">
              <strong>Stuck?</strong>
              <span>Copy this page into your AI and ask it to do the step for you.</span>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
