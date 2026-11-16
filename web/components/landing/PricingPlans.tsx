'use client';

import { useState } from 'react';
import { PLANS, planHref, yearlySaving, type Plan } from '@/lib/plans';

function note(plan: Plan, yearly: boolean): string {
  if (plan.monthly === 0) return 'Free forever. No card.';
  const saving = yearlySaving(plan);
  if (!yearly) return `Billed monthly. Switch to yearly and save $${saving}.`;
  const perDay = plan.id === 'studio' ? ` About $${((plan.yearly * 12) / 365).toFixed(2)} a day.` : '';
  return `Billed $${(plan.yearly * 12).toLocaleString('en-US')} a year. You save $${saving}.${perDay}`;
}

/** The four plan cards with the monthly / yearly switch. Yearly is the default. */
export function PricingPlans() {
  const [yearly, setYearly] = useState(true);

  return (
    <>
      <div className="m-toggle-row">
        <div className="m-toggle" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly</button>
        </div>
        <span className="m-label m-label--lime" style={{ borderColor: 'var(--ink)' }}>2 months free on yearly</span>
      </div>

      <div className="m-founding">
        <span>
          <strong>Founding price.</strong> The first 200 paying founders keep today&apos;s price for as long as they stay subscribed.
        </span>
        <span className="m-mono" style={{ color: 'var(--ink)', fontWeight: 700 }}>Paid plans open soon · join free today</span>
      </div>

      <div className="m-plans">
        {PLANS.map((plan) => (
          <div key={plan.id} className={`m-plan${plan.look ? ` m-plan--${plan.look}` : ''}`}>
            <div className="m-plan__name">
              <span>{plan.name.toUpperCase()}</span>
              {plan.look === 'top' && <span className="m-plan__badge">MOST POPULAR</span>}
            </div>
            <div className="m-plan__price">
              <b>${yearly ? plan.yearly : plan.monthly}</b>
              {plan.monthly > 0 && <span>a month</span>}
            </div>
            <span className="m-plan__note">{note(plan, yearly)}</span>
            <p className="m-plan__for">{plan.pitch}</p>
            <a href={planHref(plan)} className={`btn${plan.look === 'top' ? ' btn--lime btn--raised' : ''}`}>{plan.cta}</a>
            <ul className="m-plan__list">
              {plan.features.map((f) => (
                <li key={f.text} className={f.kind ? `is-${f.kind}` : undefined}>{f.text}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="m-assure">
        <span>Cancel in two clicks</span>
        <span>14-day money back</span>
        <span>Your data exports any time</span>
      </div>
    </>
  );
}
