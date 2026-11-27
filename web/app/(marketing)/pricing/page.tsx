import type { Metadata } from 'next';
import { PricingPlans } from '@/components/landing/PricingPlans';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { COMPARE_ROWS } from '@/lib/plans';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing — Deno',
  description:
    'One flat price and no AI credits. Your own AI plan does the thinking and your computer renders the video. Start free; Studio is $39 a month billed yearly.',
};

const FAQ: { q: string; a: string }[] = [
  { q: 'Why is there no charge per video?', a: 'Because making a video costs us almost nothing. Your AI plan writes it and your computer renders it. We charge for what Deno adds: your evidence, the rules, the media search and the review room.' },
  { q: 'What happens to my work if I cancel?', a: 'Your videos are already on your disk. Your posts, verdicts and notes stay readable on the Free plan, and you can export everything.' },
  { q: 'Can I switch plans later?', a: 'Yes, any time. Upgrades start at once and you only pay the difference.' },
  { q: 'Do I also need a paid AI plan?', a: 'For posts, no. For video we recommend Claude Pro or Max, because video work uses a lot of AI.' },
  { q: 'Can I pay today?', a: 'Not yet. Paid plans open soon. Create a free account now and you keep the founding price when they do.' },
];

export default function PricingPage() {
  return (
    <>
      <SiteHeader active="pricing" />

      <section className="m-wrap m-hero" style={{ paddingBottom: clampPad }}>
        <span className="m-label m-label--blue">Pricing</span>
        <h1 className="display m-hero__title" style={{ fontSize: 'clamp(42px, 5.6vw, 80px)', maxWidth: 1000, marginTop: 22 }}>One flat price. No AI credits, ever.</h1>
        <p className="m-hero__sub" style={{ maxWidth: 680 }}>
          Your own AI plan does the thinking and your computer does the rendering, so we never meter you per video.
          Start free and upgrade when you are ready to ship.
        </p>
        <PricingPlans />
      </section>

      <section className="m-band m-band--lime">
        <div className="m-wrap m-sec m-split">
          <div>
            <h2 className="display m-title m-title--sm" style={{ marginTop: 0 }}>Unlimited means unlimited</h2>
            <p className="m-sub" style={{ color: '#1E2A22', maxWidth: 480 }}>Studio is one price for every video, every carousel and every revision you make. Nothing is counted per render, because nothing renders on our machines.</p>
          </div>
          <div className="m-ledger">
            <div><span>Credit-based AI video tools</span><b>Pay per render</b></div>
            <div><span>Your tenth revision of the same reel</span><b>Still included</b></div>
            <div className="m-ledger__us"><span>Deno Studio, every video and every revision</span><b>$39 a month</b></div>
          </div>
        </div>
      </section>

      <section className="m-band">
        <div className="m-wrap m-sec">
          <h2 className="display m-title m-title--sm" style={{ marginTop: 0 }}>Compare every plan</h2>
          <div className="m-table-box">
            <table className="m-table">
              <thead>
                <tr>
                  <th style={{ width: '34%' }}><span className="visually-hidden">Feature</span></th>
                  <th>FREE</th>
                  <th>LAUNCH</th>
                  <th className="is-top">STUDIO</th>
                  <th>AGENCY</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell, i) => (
                      <td key={i} className={[i === 2 ? 'is-top' : '', row.off?.includes(i) ? 'is-off' : ''].join(' ').trim() || undefined}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="m-wrap" style={{ paddingBottom: 'clamp(56px, 7vw, 88px)' }}>
        <div className="m-kit">
          <div>
            <span className="m-label m-label--ink">Launch Kit · done with you</span>
            <h2 className="display" style={{ fontSize: 'clamp(28px, 3.2vw, 42px)', lineHeight: 1.1, marginTop: 18 }}>Want us to run your launch with you?</h2>
            <p style={{ margin: '14px 0 0', fontSize: 16.5, color: '#3A2A22', maxWidth: 600 }}>We validate the idea, build the 14-day plan and make the launch video together, using Deno. A few slots a month, by application.</p>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}?subject=Launch%20Kit`} className="btn btn--ink">Ask about a slot</a>
        </div>
      </section>

      <section className="m-band m-band--tint">
        <div className="m-wrap m-sec m-split m-split--top">
          <h2 className="display m-title m-title--sm" style={{ marginTop: 0, flex: '1 1 320px' }}>Questions about paying</h2>
          <div className="m-faq" style={{ flex: '2 1 560px' }}>
            {FAQ.map((item) => (
              <div key={item.q}><h3>{item.q}</h3><p>{item.a}</p></div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

const clampPad = 'clamp(48px, 6vw, 72px)';
