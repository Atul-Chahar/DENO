'use client';

import { useEffect } from 'react';

/**
 * Starts the landing page's CSS animations when each block scrolls into view. Renders nothing.
 *
 * - `[data-play]`: gets `data-armed` at once (CSS hides the parts that will animate), then `is-playing` in view.
 *   Without JavaScript, or with reduced motion, nothing is armed, so everything simply shows.
 * - `[data-count]`: a number that counts up from 0 to its value when it comes into view.
 */
export function PlayOnView() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const plays = Array.from(document.querySelectorAll<HTMLElement>('[data-play]'));
    const counts = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
    const frames: number[] = [];

    plays.forEach((el) => el.setAttribute('data-armed', ''));

    const countUp = (el: HTMLElement) => {
      const end = Number(el.dataset.count);
      if (!Number.isFinite(end) || end <= 0) return;
      const t0 = performance.now();
      const ms = 900;
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frames.push(requestAnimationFrame(step));
      };
      el.textContent = '0';
      frames.push(requestAnimationFrame(step));
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          if (el.hasAttribute('data-play')) el.classList.add('is-playing');
          if (el.hasAttribute('data-count')) countUp(el);
          io.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.25 },
    );
    [...plays, ...counts].forEach((el) => io.observe(el));

    // Safety net: never leave an armed block hidden.
    const timer = window.setTimeout(() => plays.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-playing');
    }), 1500);

    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      frames.forEach(cancelAnimationFrame);
    };
  }, []);

  return null;
}
