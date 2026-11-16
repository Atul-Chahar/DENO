/**
 * The price ladder shown on the landing and pricing pages (docs/21). Checkout is not wired yet:
 * paid buttons lead to sign-up with the chosen plan in the query string.
 * Free limits mirror the quotas the API enforces today; paid limits are the launch proposal.
 */

export interface PlanFeature {
  text: string;
  kind?: 'head' | 'off';
}

export interface Plan {
  id: 'free' | 'launch' | 'studio' | 'agency';
  name: string;
  monthly: number;
  /** Per month when billed yearly (two months free). */
  yearly: number;
  pitch: string;
  short: string;
  cta: string;
  features: PlanFeature[];
  look?: 'top' | 'ink';
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    pitch: 'Try the whole loop once.',
    short: 'Connect your AI, validate ideas and make your first video.',
    cta: 'Start free',
    features: [
      { text: 'Connect Claude, ChatGPT or any MCP app' },
      { text: '5 idea validations a month' },
      { text: '1 content plan a month' },
      { text: '200 copy checks a month' },
      { text: '1 Studio project, up to 3 versions' },
      { text: 'Deno mark on the end card', kind: 'off' },
    ],
  },
  {
    id: 'launch',
    name: 'Launch',
    monthly: 29,
    yearly: 24,
    pitch: 'For founders who post, not film.',
    short: 'Unlimited posts and plans in your voice.',
    cta: 'Get Launch',
    features: [
      { text: 'Everything in Free, plus:', kind: 'head' },
      { text: '15 idea validations a month' },
      { text: 'Unlimited content plans, up to 30 days' },
      { text: 'Unlimited copy checks and rewrites' },
      { text: 'Story Bank and voice matching' },
      { text: 'No video or carousel Studio', kind: 'off' },
    ],
  },
  {
    id: 'studio',
    name: 'Studio',
    monthly: 49,
    yearly: 39,
    pitch: 'Posts, videos and carousels. No limits on making.',
    short: 'Unlimited videos, carousels and posts, with review and taste memory.',
    cta: 'Get Studio',
    look: 'top',
    features: [
      { text: 'Everything in Launch, plus:', kind: 'head' },
      { text: 'Unlimited Studio projects and versions' },
      { text: 'Launch videos, reels, explainers, carousels' },
      { text: 'Frame-pinned review and taste memory' },
      { text: 'Brand kit and an editable Rulebook' },
      { text: '30 idea validations a month' },
      { text: 'No Deno mark on your videos' },
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    monthly: 149,
    yearly: 119,
    pitch: 'For teams making content for several brands.',
    short: 'Five brands, five seats and client review links.',
    cta: 'Get Agency',
    look: 'ink',
    features: [
      { text: 'Everything in Studio, plus:', kind: 'head' },
      { text: '5 brands, each with its own kit and voice' },
      { text: '5 seats' },
      { text: 'Review links your clients can comment on' },
      { text: '100 idea validations a month' },
      { text: 'Front of the run line' },
    ],
  },
];

export function planHref(plan: Plan): string {
  return plan.id === 'free' ? '/auth?mode=signup' : `/auth?mode=signup&plan=${plan.id}`;
}

export function yearlySaving(plan: Plan): number {
  return (plan.monthly - plan.yearly) * 12;
}

export const COMPARE_ROWS: { label: string; cells: [string, string, string, string]; off?: number[] }[] = [
  { label: 'Connect your AI over MCP', cells: ['Yes', 'Yes', 'Yes', 'Yes'] },
  { label: 'Idea validations a month', cells: ['5', '15', '30', '100'] },
  { label: 'Content plans', cells: ['1 a month', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Copy checks against the slop rules', cells: ['200 a month', 'Unlimited', 'Unlimited', 'Unlimited'] },
  { label: 'Studio projects (video, reels, carousels)', cells: ['1', 'Not included', 'Unlimited', 'Unlimited'], off: [1] },
  { label: 'Frame-pinned review notes', cells: ['Yes', 'Not included', 'Yes', 'Yes, with client links'], off: [1] },
  { label: 'Taste memory and editable Rulebook', cells: ['Read only', 'Read only', 'Yes', 'Yes, per brand'], off: [0, 1] },
  { label: 'Brands', cells: ['1', '1', '1', '5'] },
  { label: 'Seats', cells: ['1', '1', '1', '5'] },
];
