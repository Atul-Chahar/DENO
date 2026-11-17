import type { Metadata } from 'next';
import { FormatCard, VideoCard } from '@/components/gallery/Cards';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { FORMATS, STYLES, VIDEOS, isStill } from '@/lib/gallery';

export const metadata: Metadata = {
  title: 'AI video gallery: launch videos and reels with their prompts — Deno',
  description:
    'Marketing videos written and rendered by an AI such as Claude, each with the prompt that started it. Pick a format, copy the prompt, and ask your own AI for the same.',
  alternates: { canonical: '/videos' },
};

export default function VideosPage() {
  const newest = [...VIDEOS].sort((a, b) => b.published.localeCompare(a.published));
  const films = FORMATS.filter((f) => !isStill(f));
  const stills = FORMATS.filter(isStill);
  return (
    <>
      <SiteHeader active="videos" />

      <section className="m-wrap m-hero">
        <span className="m-label m-label--lime">Video gallery</span>
        <h1 className="display m-hero__title" style={{ fontSize: 'clamp(42px, 5.6vw, 80px)', maxWidth: 1000, marginTop: 22 }}>
          Videos made by talking to an AI.
        </h1>
        <p className="m-hero__sub">
          A founder describes the video. Their own AI writes it as code and renders it on their computer. Each entry names its format,
          and links to the maker&apos;s prompt when they shared one, so you can ask your AI for the same.
        </p>
        <div className="m-hero__actions">
          <a href="#formats" className="btn btn--lime btn--raised">Pick a format</a>
          <a href="/videos/submit" className="btn btn--ghost">Publish your video</a>
        </div>
        <p className="m-mono m-hero__note">{FORMATS.length} formats · {STYLES.length} styles · every prompt free to copy</p>
      </section>

      <section className="m-band" id="made">
        <div className="m-wrap m-sec">
          <span className="m-label m-label--peach">Made with AI</span>
          <h2 className="display m-title m-title--sm">Watch one, then copy its prompt.</h2>
          <p className="g-fine" style={{ marginTop: 10 }}>
            Community videos are listed with credit and a link to the original post. If one is yours and you want it removed, ask at{' '}
            <a href="/takedown">/takedown</a>.
          </p>
          {newest.length > 0 ? (
            <div className="g-videos">
              {newest.map((v) => <VideoCard key={v.slug} video={v} />)}
            </div>
          ) : (
            <div className="g-empty">
              <p>
                The gallery is new, so the first videos are not listed yet. If you made a marketing video with an AI, yours can be
                one of the first.
              </p>
              <a href="/videos/submit" className="btn btn--ink">Publish your video</a>
            </div>
          )}
        </div>
      </section>

      <section className="m-band m-band--ink" id="formats">
        <div className="m-wrap m-sec">
          <span className="m-label m-label--lime">Formats</span>
          <h2 className="display m-title">Tell your AI which one you want.</h2>
          <p className="m-sub">
            Each format is a shape that already works: how long, what each second is for, where the product shows. Open one, copy its
            prompt, and paste it into Claude or any AI connected to Deno.
          </p>
          <div className="m-grid m-grid--4">
            {films.map((f) => <FormatCard key={f.slug} format={f} />)}
            {stills.map((f) => <FormatCard key={f.slug} format={f} />)}
          </div>
        </div>
      </section>

      <section className="m-band m-band--tint" id="styles">
        <div className="m-wrap m-sec m-split m-split--top">
          <div style={{ flex: '1 1 320px' }}>
            <span className="m-label m-label--blue">Styles</span>
            <h2 className="display m-title m-title--sm">Then name the look.</h2>
            <p className="m-sub">Any format can take any style. Say the style by name in your prompt and your AI loads its rules from Deno.</p>
          </div>
          <div className="m-faq" style={{ flex: '2 1 560px' }}>
            {STYLES.map((s) => (
              <div key={s.slug} id={`style-${s.slug}`}>
                <h3>{s.title} <span className="m-mono" style={{ marginLeft: 8 }}>{s.slug}</span></h3>
                <p>{s.summary}</p>
                {s.best_for && <p className="g-fine"><strong>Best for:</strong> {s.best_for}.{s.avoid_for ? <> <strong>Not for:</strong> {s.avoid_for}.</> : null}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="m-wrap m-cta" style={{ paddingTop: 'clamp(56px, 7vw, 96px)' }}>
        <div className="m-cta__box">
          <h2 className="display m-cta__title">Your AI can make these today.</h2>
          <p>Connect Deno once. Your AI gets the formats, the styles, licensed media, and the real facts about your idea.</p>
          <div className="m-hero__actions">
            <a href="/docs/quickstart" className="btn btn--lime">Set up in 2 minutes</a>
            <a href="/pricing" className="btn btn--ghost">See pricing</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
