import type { Metadata } from 'next';
import { PersonaCards } from '@/components/landing/PersonaCards';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';

export const metadata: Metadata = {
  title: 'Who Deno is for — Deno',
  description: 'Founders, content creators, indie hackers, agencies and educators: tell Deno who you are once, and your AI makes every video in the format that fits you.',
  alternates: { canonical: '/for' },
};

export default function ForPage() {
  return (
    <>
      <SiteHeader active="for" />
      <main>
        <section className="m-wrap m-hero">
          <span className="m-label m-label--peach">Who are you?</span>
          <h1 className="display m-hero__title" style={{ fontSize: 'clamp(40px, 5vw, 72px)', maxWidth: 1000, marginTop: 18 }}>One answer sets how every video is made.</h1>
          <p className="m-hero__sub">
            Pick what you are. Your AI then starts every video in your format: the length, the frame, how fast it cuts,
            how the first second hooks, and how the captions look. It keeps learning from the videos you approve and the
            notes you leave.
          </p>
        </section>
        <section className="m-wrap m-sec" style={{ paddingTop: 0 }}>
          <PersonaCards />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
