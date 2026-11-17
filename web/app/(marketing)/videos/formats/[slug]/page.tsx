import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { FormatCard, VideoCard } from '@/components/gallery/Cards';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { FORMATS, STYLES, findFormat, findStyle, formatHref, formatPrompt, isStill, videosForFormat } from '@/lib/gallery';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const f = findFormat((await params).slug);
  if (!f) return { title: 'Video formats — Deno' };
  return {
    title: `${f.title}: AI video prompt and shot plan — Deno`,
    description: `${f.summary} Copy the prompt and ask Claude or your own AI to make it.`,
    alternates: { canonical: formatHref(f.slug) },
  };
}

export default async function FormatPage({ params }: { params: Params }) {
  const f = findFormat((await params).slug);
  if (!f) notFound();
  const style = findStyle(f.style);
  const prompt = formatPrompt(f);
  const made = videosForFormat(f.slug);
  const others = FORMATS.filter((x) => x.slug !== f.slug && (x.ratio === f.ratio || x.style === f.style)).slice(0, 4);
  const otherStyles = STYLES.filter((s) => s.slug !== f.style);

  return (
    <>
      <SiteHeader active="videos" />

      <section className="m-wrap m-hero">
        <p className="m-mono g-crumbs"><a href="/videos">Videos</a> / <a href="/videos#formats">Formats</a> / {f.title}</p>
        <h1 className="display m-hero__title" style={{ fontSize: 'clamp(40px, 5vw, 72px)', maxWidth: 1000, marginTop: 18 }}>{f.title}</h1>
        <p className="m-hero__sub">{f.summary}</p>
        <dl className="g-facts">
          <div><dt>Frame</dt><dd>{f.ratio}</dd></div>
          <div><dt>Length</dt><dd>{isStill(f) ? 'Still pages' : `${f.seconds} seconds`}</dd></div>
          <div><dt>Usual style</dt><dd>{style?.title ?? f.style}</dd></div>
          <div><dt>Made in</dt><dd>Claude Code + Deno Studio</dd></div>
        </dl>
      </section>

      <section className="m-band">
        <div className="m-wrap m-sec m-split m-split--top">
          <div>
            <span className="m-label m-label--peach">The shape</span>
            <h2 className="display m-title m-title--sm">What each second is for.</h2>
            <div className="g-prose">
              {f.body.split(/\n{2,}/).map((para) => <p key={para.slice(0, 40)}>{para.replace(/\n/g, ' ')}</p>)}
            </div>
            {style && (
              <div className="g-style">
                <span className="m-mono">Style: {style.slug}</span>
                <p><strong>{style.title}.</strong> {style.summary}</p>
              </div>
            )}
          </div>
          <div>
            <div className="m-prompt m-prompt--stack" style={{ marginTop: 0 }}>
              <div className="m-prompt__say">
                <span className="m-mono">The prompt</span>
                <h3>Paste this into your AI.</h3>
                <p>It names the format and the style, so your AI loads the right rules from Deno and works from your real facts.</p>
                <CopyButton text={prompt} label="Copy prompt" done="Copied" className="btn btn--lime" />
              </div>
              <pre className="m-prompt__text">{prompt}</pre>
            </div>
            <p className="g-fine" style={{ marginTop: 18 }}>
              Want another look? Change the style name to one of:{' '}
              {otherStyles.map((s, i) => (
                <span key={s.slug}>{i > 0 ? ', ' : ''}<a href={`/videos#style-${s.slug}`}><code>{s.slug}</code></a></span>
              ))}.
            </p>
          </div>
        </div>
      </section>

      <section className="m-band m-band--tint">
        <div className="m-wrap m-sec">
          <span className="m-label m-label--blue">Before you paste</span>
          <h2 className="display m-title m-title--sm">Three things your AI needs first.</h2>
          <div className="m-grid m-grid--3">
            <div className="m-step" style={{ background: '#fff' }}>
              <span className="m-step__n">1</span>
              <h3>A free Deno account</h3>
              <p>It holds your idea, the evidence behind it and your brand kit.</p>
              <a href="/auth?mode=signup" className="btn btn--sm btn--ghost" style={{ alignSelf: 'flex-start' }}>Create an account</a>
            </div>
            <div className="m-step" style={{ background: '#fff' }}>
              <span className="m-step__n">2</span>
              <h3>Deno connected to your AI</h3>
              <p>One paste sets it up. Video needs Claude Code, because the video renders on your computer.</p>
              <a href="/docs/quickstart" className="btn btn--sm btn--ghost" style={{ alignSelf: 'flex-start' }}>Open the quickstart</a>
            </div>
            <div className="m-step" style={{ background: '#fff' }}>
              <span className="m-step__n">3</span>
              <h3>One validated idea</h3>
              <p>The video is built from what real people said about your problem, so it has something true to say.</p>
              <a href="/docs/validate" className="btn btn--sm btn--ghost" style={{ alignSelf: 'flex-start' }}>How validation works</a>
            </div>
          </div>
        </div>
      </section>

      {made.length > 0 && (
        <section className="m-band">
          <div className="m-wrap m-sec">
            <span className="m-label m-label--peach">Made with this format</span>
            <div className="g-videos">{made.map((v) => <VideoCard key={v.slug} video={v} />)}</div>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="m-band m-band--ink">
          <div className="m-wrap m-sec">
            <span className="m-label m-label--lime">Close to this one</span>
            <div className="m-grid m-grid--4">{others.map((x) => <FormatCard key={x.slug} format={x} />)}</div>
          </div>
        </section>
      )}

      <SiteFooter />
    </>
  );
}
