import { FORMAT_TONE, type Format, type GalleryVideo, findFormat, formatHref, formatMeta, isStill, posterUrl, videoHref } from '@/lib/gallery';

/** The frame's shape drawn to scale, so 9:16 and 16:9 read at a glance without a thumbnail. */
function Shape({ ratio, label }: { ratio: string; label: string }) {
  const [w, h] = ratio.split(':').map(Number);
  const ok = w > 0 && h > 0;
  return (
    <div className="g-shape" style={{ aspectRatio: ok ? `${w} / ${h}` : '16 / 9', background: FORMAT_TONE[ratio] ?? 'var(--paper-2)' }}>
      <span>{label}</span>
    </div>
  );
}

/** A format (recipe) card on a dark band. */
export function FormatCard({ format }: { format: Format }) {
  return (
    <a href={formatHref(format.slug)} className="m-make g-card">
      <div className="m-make__art g-art">
        <Shape ratio={format.ratio} label={isStill(format) ? 'PAGES' : `${format.seconds} S`} />
      </div>
      <h3>{format.title}</h3>
      <p>{format.summary}</p>
      <span className="m-make__meta">{formatMeta(format).toUpperCase()}</span>
    </a>
  );
}

/** A published video card on a light band. */
export function VideoCard({ video }: { video: GalleryVideo }) {
  const poster = posterUrl(video);
  const format = findFormat(video.format);
  return (
    <a href={videoHref(video.slug)} className="g-video">
      <div className="g-video__art" style={poster ? undefined : { background: FORMAT_TONE[video.ratio] ?? 'var(--paper-2)' }}>
        {poster ? <img src={poster} alt="" loading="lazy" /> : <span className="m-mono">{video.ratio}</span>}
        <span className="g-video__time">{`0:${String(Math.round(video.seconds)).padStart(2, '0')}`}</span>
        {video.prompt && <span className="g-video__tag">PROMPT</span>}
      </div>
      <h3>{video.title}</h3>
      <p>{video.summary}</p>
      <span className="g-video__meta">
        {video.maker.name} · {video.model}
        {format ? ` · ${format.title}` : ''}
      </span>
    </a>
  );
}
