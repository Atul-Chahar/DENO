import type { Metadata } from 'next';
import { CopyButton } from '@/components/CopyButton';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { PLUGIN_REPO } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Publish your AI-made video — Deno',
  description: 'List a marketing video you made with an AI in the Deno gallery, with your name, your link and your prompt. Free.',
  alternates: { canonical: '/videos/submit' },
};

const FORM = `Video link (YouTube, Vimeo, X or LinkedIn):
Title:
One or two sentences on what it is for:
Your name, and a link to credit (site or profile):
AI and app (for example: Claude Opus 5.5 in Claude Code):
Format and style, if you used Deno's (for example: saas-launch-32, living-ui):
Frame and length (for example: 9:16, 20 s):
Made with Deno Studio? (yes / no)
Your first prompt, word for word (optional, but it is what people come for):
Review rounds it took (optional):

I made this video, or I have the maker's permission to list it.`;

const issueUrl = `https://github.com/${PLUGIN_REPO}/issues/new?title=${encodeURIComponent('Gallery: <your video title>')}&body=${encodeURIComponent(FORM)}`;
const mailUrl = `mailto:hello@deno.gtm?subject=${encodeURIComponent('Gallery submission')}&body=${encodeURIComponent(FORM)}`;

export default function SubmitVideoPage() {
  return (
    <>
      <SiteHeader active="videos" />

      <section className="m-wrap m-hero">
        <p className="m-mono g-crumbs"><a href="/videos">Videos</a> / Publish yours</p>
        <h1 className="display m-hero__title" style={{ fontSize: 'clamp(40px, 5vw, 72px)', maxWidth: 1000, marginTop: 18 }}>Publish your AI-made video.</h1>
        <p className="m-hero__sub">
          If an AI wrote and rendered your marketing video, list it here with your name, your link and the prompt that started it.
          It is free, and you can ask us to remove it at any time.
        </p>
      </section>

      <section className="m-band">
        <div className="m-wrap m-sec">
          <div className="m-grid m-grid--3" style={{ marginTop: 0 }}>
            <div className="m-step" style={{ background: 'var(--green-soft)' }}>
              <span className="m-step__n">1</span>
              <h3>Post the video where you want it</h3>
              <p>YouTube, Vimeo, X or LinkedIn. It stays on your account. Deno never stores or hosts the file; the gallery only links to it.</p>
            </div>
            <div className="m-step" style={{ background: 'var(--peach)' }}>
              <span className="m-step__n">2</span>
              <h3>Send us the link and the prompt</h3>
              <p>Fill in the short form below. The prompt is optional, but a video with its prompt gets opened far more often.</p>
            </div>
            <div className="m-step" style={{ background: 'var(--blue-soft)' }}>
              <span className="m-step__n">3</span>
              <h3>We check it and list it</h3>
              <p>A person looks at every submission before it goes live. We list videos by their maker, or with the maker&apos;s permission.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="m-band m-band--tint">
        <div className="m-wrap m-sec m-split m-split--top">
          <div>
            <span className="m-label m-label--amber">The form</span>
            <h2 className="display m-title m-title--sm">Two ways to send it.</h2>
            <p className="m-sub">Both open with the form already filled in. Pick the one you use.</p>
            <div className="m-hero__actions">
              <a href={issueUrl} target="_blank" rel="noreferrer" className="btn btn--ink">Submit on GitHub ↗</a>
              <a href={mailUrl} className="btn btn--ghost">Send by email</a>
            </div>
            <p className="g-fine" style={{ marginTop: 18 }}>
              A GitHub submission is public from the moment you post it. Use email if you would rather it stayed private until it is listed.
            </p>
          </div>
          <div className="m-prompt m-prompt--stack" style={{ marginTop: 0 }}>
            <div className="m-prompt__say">
              <span className="m-mono">What we ask for</span>
              <CopyButton text={FORM} label="Copy the form" done="Copied" className="btn btn--lime" />
            </div>
            <pre className="m-prompt__text">{FORM}</pre>
          </div>
        </div>
      </section>

      <section className="m-wrap m-sec">
        <h2 className="display m-title m-title--sm" style={{ marginTop: 0 }}>Rules</h2>
        <div className="m-faq" style={{ marginTop: 28, maxWidth: 860 }}>
          <div><h3>Whose videos can be listed?</h3><p>Yours, or one whose maker said yes. Every entry credits its maker and links to the original post.</p></div>
          <div><h3>Does it have to be made with Deno?</h3><p>No. Videos made with Deno Studio are marked as such; others are listed as Community.</p></div>
          <div><h3>What is not listed?</h3><p>Videos with invented numbers or fake quotes, media you do not have the right to use, and anything that is not marketing for a real product or project.</p></div>
          <div><h3>How do I remove mine?</h3><p>Write to <a href="mailto:hello@deno.gtm">hello@deno.gtm</a> or use the <a href="/takedown">takedown page</a>. We take it down and do not ask why.</p></div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
