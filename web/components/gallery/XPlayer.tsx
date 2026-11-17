'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Plays a video posted on X inside X's official embedded post (docs/23). The file stays on X; we only frame it.
 * The embed tells its parent how tall it is through postMessage, so the frame grows to fit without a scrollbar.
 */
export function XPlayer({ src, title, ratio = '16:9' }: { src: string; title: string; ratio?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Until the embed reports its size: room for the post text, the video (X shows tall videos taller) and the footer.
  const [height, setHeight] = useState(ratio === '9:16' ? 900 : ratio === '1:1' || ratio === '4:3' ? 760 : 640);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://platform.twitter.com' || e.source !== frame.current?.contentWindow) return;
      let data: unknown = e.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const embed = (data as { 'twttr.embed'?: { method?: string; params?: { height?: number }[] } } | null)?.['twttr.embed'];
      const h = embed?.method === 'twttr.private.resize' ? embed.params?.[0]?.height : undefined;
      if (typeof h === 'number' && h > 100 && h < 3000) setHeight(Math.ceil(h));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="g-player__x">
      <iframe ref={frame} src={src} title={title} style={{ height }} allow="fullscreen" allowFullScreen />
    </div>
  );
}
