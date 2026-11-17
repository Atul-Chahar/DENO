import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { VideoCard } from '@/components/gallery/Cards';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { VIDEOS, embedUrl, findFormat, findStyle, findVideo, formatHref, formatPrompt, hostName, isoDuration, posterUrl, videoHref } from '@/lib/gallery';
import { SITE_URL } from '@/lib/site';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const v = findVideo((await params).slug);
  if (!v) return { title: 'Video gallery — Deno' };
  return {
    title: `${v.title}: made with ${v.model}${v.prompt || v.promptUrl ? ', with its prompt' : ''} — Deno`,
    description: v.summary,
    alternates: { canonical: videoHref(v.slug) },
  };
}

export default async function VideoPage({ params }: { params: Params }) {
  const v = findVideo((await params).slug);
  if (!v) notFound();
  const format = findFormat(v.format);
  const style = findStyle(v.style);
  const embed = embedUrl(v.url);
  const poster = posterUrl(v);
  const host = hostName(v.url);
  const more = VIDEOS.filter((x) => x.slug !== v.slug && (x.format === v.format || x.style === v.style)).slice(0, 3);
  const absolute = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path}`);
  // Search engines need a thumbnail for a video result; without one we describe it as a creative work only.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': poster ? 'VideoObject' : 'CreativeWork',
    name: v.title,
    description: v.summary,
    uploadDate: v.published,
    ...(poster ? { thumbnailUrl: absolute(poster), duration: isoDuration(v.seconds), ...(embed ? { embedUrl: embed } : { contentUrl: v.url }) } : { url: v.url }),
    creator: { '@type': 'Person', name: v.maker.name, ...(v.maker.url ? { url: v.maker.url } : {}) },
  };

  return (
    <>
      <SiteHeader active="videos" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <section className="m-wrap m-hero">
        <p className="m-mono g-crumbs"><a href="/videos">Videos</a> / {v.title}</p>
        <div className="m-split m-split--top" style={{ marginTop: 22 }}>
          <div className={`g-player${v.ratio === '9:16' ? ' g-player--tall' : ''}`}>
            {embed ? (
              <iframe src={embed} title={v.title} style={{ aspectRatio: v.ratio.replace(':', ' / ') }} allow="fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
            ) : (
              <a href={v.url} target="_blank" rel="noreferrer" className="g-player__out" style={{ aspectRatio: v.ratio.replace(':', ' / ') }}>
                {poster && <img src={poster} alt="" />}
                <span className="btn btn--lime btn--raised">Watch on {host} ↗</span>
              </a>
            )}
          </div>
          <div>
            <span className={`m-label ${v.madeWithDeno ? 'm-label--lime' : 'm-label--blue'}`}>{v.madeWithDeno ? 'Made with Deno Studio' : 'Community'}</span>
            <h1 className="display m-title m-title--sm">{v.title}</h1>
            <p className="m-sub">{v.summary}</p>
            <dl className="g-facts">
              <div><dt>Made by</dt><dd>{v.maker.url ? <a href={v.maker.url} target="_blank" rel="noreferrer">{v.maker.name}</a> : v.maker.name}</dd></div>
              <div><dt>AI</dt><dd>{v.app ? `${v.model} in ${v.app}` : v.model}</dd></div>
              <div><dt>Format</dt><dd>{format ? <a href={formatHref(format.slug)}>{format.title}</a> : v.format}</dd></div>
              <div><dt>Style</dt><dd>{style?.title ?? v.style}</dd></div>
              <div><dt>Frame</dt><dd>{v.ratio} · {Math.round(v.seconds)} s</dd></div>
              {v.rounds ? <div><dt>Review rounds</dt><dd>{v.rounds}</dd></div> : null}
            </dl>
            <div className="m-hero__actions" style={{ marginTop: 20 }}>
              <a href={v.url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">Original post on {host} ↗</a>
              {v.promptUrl && !v.prompt && (
                <a href={v.promptUrl} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">Read the maker&apos;s prompt ↗</a>
              )}
            </div>
            {!v.madeWithDeno && (
              <p className="g-fine" style={{ marginTop: 14 }}>
                Listed with credit and a link to the original. The video and its prompt belong to {v.maker.name}.{' '}
                <a href="/takedown">Ask for removal</a>.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="m-band m-band--tint">
        <div className="m-wrap m-sec m-split m-split--top">
          {v.prompt && (
            <div className="m-prompt m-prompt--stack" style={{ marginTop: 0 }}>
              <div className="m-prompt__say">
                <span className="m-mono">The maker&apos;s prompt</span>
                <h3>What {v.maker.name} asked for.</h3>
                <CopyButton text={v.prompt} label="Copy prompt" done="Copied" className="btn btn--lime" />
              </div>
              <pre className="m-prompt__text">{v.prompt}</pre>
            </div>
          )}
          {format && (
            <div className="m-prompt m-prompt--stack" style={{ marginTop: 0 }}>
              <div className="m-prompt__say">
                <span className="m-mono">Make one like this</span>
                <h3>The same format, for your idea.</h3>
                <p>This prompt asks your AI for the {format.title} in the {style?.title ?? v.style} style, built from your own facts.</p>
                <CopyButton text={formatPrompt(format, v.style)} label="Copy prompt" done="Copied" className="btn btn--lime" />
              </div>
              <pre className="m-prompt__text">{formatPrompt(format, v.style)}</pre>
            </div>
          )}
        </div>
      </section>

      {more.length > 0 && (
        <section className="m-band">
          <div className="m-wrap m-sec">
            <span className="m-label m-label--peach">More like this</span>
            <div className="g-videos">{more.map((x) => <VideoCard key={x.slug} video={x} />)}</div>
          </div>
        </section>
      )}

      <SiteFooter />
    </>
  );
}
