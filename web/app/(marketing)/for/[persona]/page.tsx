import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { CodeBlock } from '@/components/setup/CodeBlock';
import { PersonaCards } from '@/components/landing/PersonaCards';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { findFormat, findStyle, formatHref } from '@/lib/gallery';
import { PERSONAS, lengthText, pacingText, personaFromSlug, personaHref } from '@/lib/personas';
import { INSTALL_CMD } from '@/lib/site';

type Params = Promise<{ persona: string }>;

const CAPTIONS: Record<string, string> = {
  'beast-mode': 'Big and bold, 2–3 words at a time',
  billboard: 'Huge titles, about 3 words',
  sideline: 'Short lines low in the frame',
  'butter-serif': 'Calm serif sentences',
};

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ persona: personaHref(p.id).slice('/for/'.length) }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = personaFromSlug((await params).persona);
  if (!p) return { title: 'Who Deno is for — Deno' };
  return {
    title: `Deno for ${p.audience}: ${p.headline}`,
    description: `${p.pitch} Your AI makes it, Deno keeps it on format.`,
    alternates: { canonical: personaHref(p.id) },
  };
}

export default async function PersonaPage({ params }: { params: Params }) {
  const p = personaFromSlug((await params).persona);
  if (!p) notFound();
  const main = findFormat(p.recipe);
  const style = findStyle(p.style);
  const more = p.also.map(findFormat).filter((f) => f !== undefined);

  return (
    <>
      <SiteHeader active="for" />
      <main>
        <section className="m-wrap m-hero">
          <p className="m-mono g-crumbs"><a href="/for">Who it&apos;s for</a> / {p.label}</p>
          <h1 className="display m-hero__title" style={{ fontSize: 'clamp(40px, 5vw, 72px)', maxWidth: 1000, marginTop: 18 }}>{p.headline}</h1>
          <p className="m-hero__sub">{p.pitch}</p>
          <dl className="g-facts">
            <div><dt>Frame</dt><dd>{p.ratios.join(', ')}</dd></div>
            <div><dt>Length</dt><dd>{lengthText(p)}</dd></div>
            <div><dt>Pacing</dt><dd>{pacingText(p)}</dd></div>
            <div><dt>Captions</dt><dd>{CAPTIONS[p.captions] ?? p.captions}</dd></div>
            <div><dt>Style</dt><dd>{style?.title ?? p.style}</dd></div>
          </dl>
        </section>

        <section className="m-band">
          <div className="m-wrap m-sec m-split m-split--top">
            <div>
              <span className="m-label m-label--peach">Your format</span>
              <h2 className="display m-title m-title--sm">How your AI makes and edits your videos.</h2>
              <div className="g-prose">
                <p><strong>The first second.</strong> {p.hook}</p>
                <p><strong>Pacing.</strong> {p.pacing}</p>
                <p><strong>Tone.</strong> {p.tone}</p>
                <p><strong>Captions.</strong> {p.caption_note}</p>
                <p><strong>Sound.</strong> {p.sound}</p>
                <p><strong>The ending.</strong> {p.ending}</p>
              </div>
              <p className="m-fine" style={{ marginTop: 18 }}>
                These are where your AI starts. Ask for something else in any chat and it does that instead.
              </p>
            </div>
            <div>
              <div className="m-prompt m-prompt--stack" style={{ marginTop: 0 }}>
                <div className="m-prompt__say">
                  <span className="m-mono">Say this to your AI</span>
                  <h3>Start with one of these.</h3>
                  <p>Deno fills in your idea, your proof, your voice and your brand. You never paste them in.</p>
                </div>
                {p.prompts.map((text) => (
                  <div key={text} className="m-prompt__say" style={{ borderTop: 'var(--hair-dark)', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingTop: 18, paddingBottom: 18 }}>
                    <span style={{ flex: '1 1 240px', minWidth: 0 }}>&ldquo;{text}&rdquo;</span>
                    <CopyButton text={text} className="btn btn--sm btn--lime" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="m-band m-band--ink">
          <div className="m-wrap m-sec">
            <span className="m-label m-label--lime">Formats you start from</span>
            <h2 className="display m-title m-title--sm">Ready to render the moment your AI fills them in.</h2>
            <div className="m-grid m-grid--3">
              {[main, ...more].filter((f) => f !== undefined).map((f, i) => (
                <a key={f.slug} href={formatHref(f.slug)} className="m-make m-hit">
                  <span className="m-mono" style={{ color: i === 0 ? 'var(--lime)' : 'var(--on-dark-dim)' }}>{i === 0 ? 'YOUR FIRST SUGGESTION' : 'ALSO FITS'}</span>
                  <h3>{f.title}</h3>
                  <p>{f.summary}</p>
                  <span className="m-make__meta">{f.ratio} · {f.seconds ? `${f.seconds} S` : 'STILLS'} · SEE IT →</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="m-band m-band--tint">
          <div className="m-wrap m-sec m-split m-split--top">
            <div>
              <span className="m-label m-label--blue">It learns</span>
              <h2 className="display m-title m-title--sm">Your format moves as you work.</h2>
              <p className="m-sub">You pick a starting point once. After that, Deno watches what you actually keep.</p>
            </div>
            <ul className="g-prose" style={{ flex: '1 1 420px', paddingLeft: 20, fontSize: 17.5, lineHeight: 1.6, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li>Every video you save counts once. Every video you approve counts twice.</li>
              <li>After three, the frame, format, style and captions you keep choosing become your defaults.</li>
              <li>Notes like &ldquo;too slow&rdquo; or &ldquo;too long&rdquo; change the pacing and length of the next video.</li>
              <li>Your Account page lists what changed, in plain words. You can switch who you are at any time.</li>
            </ul>
          </div>
        </section>

        <section className="m-wrap m-sec">
          <span className="m-label m-label--green">Not you?</span>
          <h2 className="display m-title m-title--sm">Other ways people use Deno.</h2>
          <PersonaCards current={p.id} />
        </section>

        <section className="m-wrap m-cta">
          <div className="m-cta__box">
            <h2 className="display m-cta__title">Install once. Your AI asks who you are, then gets to work.</h2>
            <p>Free to start, no card. Video needs Claude Code.</p>
            <div className="m-cta__cmd"><CodeBlock code={INSTALL_CMD} /></div>
            <div className="m-hero__actions">
              <a href="/#install" className="btn btn--lime btn--lg">Other systems and apps</a>
              <a href="/docs/personas" className="btn btn--ghost btn--lg">How personas work</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
