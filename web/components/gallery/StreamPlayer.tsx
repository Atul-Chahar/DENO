'use client';

import { useState } from 'react';
import { XPlayer } from './XPlayer';

/**
 * Plays a gallery video from its direct MP4 link (`stream`, docs/23) with the browser's own player.
 * If the file stops loading (the host removed it or blocks us), falls back to X's official embedded post.
 */
export function StreamPlayer({ stream, poster, ratio, title, xEmbed }: { stream: string; poster?: string | null; ratio: string; title: string; xEmbed: string | null }) {
  const [failed, setFailed] = useState(false);
  if (failed && xEmbed) return <XPlayer src={xEmbed} title={title} ratio={ratio} />;
  return (
    <video
      className="g-player__video"
      src={stream}
      poster={poster ?? undefined}
      style={{ aspectRatio: ratio.replace(':', ' / ') }}
      controls
      playsInline
      preload="metadata"
      aria-label={title}
      onError={() => setFailed(true)}
    />
  );
}
