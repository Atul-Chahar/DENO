import type { ReactNode } from 'react';
import { CodeBlock } from '@/components/setup/CodeBlock';
import { Faq } from '@/components/landing/Faq';
import { InstallBox } from '@/components/landing/InstallBox';
import { InstallTerminal } from '@/components/landing/InstallTerminal';
import { PlayOnView } from '@/components/landing/PlayOnView';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { SetupPrompt } from '@/components/setup/SetupPrompt';
import { SetupTabs } from '@/components/setup/SetupTabs';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { SiteHeader } from '@/components/landing/SiteHeader';
import { PLANS, planHref } from '@/lib/plans';
import { INSTALL_CMD, MCP_URL } from '@/lib/site';

const FRAMES: { t: string; bg?: string; cls?: string; pin?: boolean }[] = [
  { t: '00:00', cls: 'm-frame--ink' },
  { t: '00:02', bg: 'var(--green-soft)' },
  { t: '00:04', bg: 'var(--lime)', pin: true },
  { t: '00:07', bg: 'var(--peach)' },
  { t: '00:10', bg: 'var(--blue-soft)' },
  { t: '00:13', cls: 'm-frame--ink' },
  { t: '00:16', bg: 'var(--amber-soft)' },
  { t: '00:19', cls: 'm-frame--ink' },
];

const COMPARE: [string, string][] = [
  ["Guesses the customer's pain", 'Quotes pains from real posts, with the link'],
  ['Invents numbers that sound good', "Blocks any number that isn't in your evidence"],
  ['Writes in the house AI voice', 'Matches your writing samples and your stories'],
  ['Grabs any image it finds', 'Uses licensed media and writes the credits file'],
  ['Forgets your notes next chat', 'Remembers every fix you asked for as your taste'],
];

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'What does the install command do?',
    a: (
      <>
        It checks for Claude Code (and offers Anthropic&apos;s official installer if it is missing), adds the Deno plugin,
        puts a <span className="m-inline">studio</span> command on your computer, downloads the video renderer
        (Chromium, plus ffmpeg if you have none) into <span className="m-inline">~/.deno-studio</span>, and opens your
        browser so you can sign in. Nothing installs system-wide, and it is safe to run again.{' '}
        <a href="/install.sh" className="link-mono" target="_blank" rel="noopener">Read the script →</a>
      </>
    ),
  },
  { q: 'Do I need a Deno account first?', a: 'No. When your browser opens to sign in, you can make a free account right there. No card.' },
  {
    q: 'I never use a terminal. Can I still use Deno?',
    a: 'Yes. Choose "No terminal" at the top of this page. Claude, ChatGPT and Cursor connect from their settings in about a minute, and you can validate ideas and write posts there. Making video needs Claude Code today.',
  },
  { q: 'Do I need to pay for Claude or ChatGPT too?', a: 'Posts work on a free AI plan. Video is heavy work, so we recommend Claude Pro or Max. Deno never charges you for AI usage.' },
  { q: 'Where do my videos go?', a: 'They stay on your computer. Deno stores a poster image and a contact sheet so you can review, plus your notes.' },
  { q: 'Will Deno post for me?', a: 'Never. Deno does not post, vote or message. You copy the post and press send yourself.' },
  { q: 'What is MCP? Do I need to understand it?', a: 'No. MCP is the standard way AI apps connect to other products. The installer or one settings page does it for you, and you sign in once.' },
  {
    q: 'How do I update or remove it?',
    a: (
      <>
        Run the same command again to update. To remove it, run{' '}
        <span className="m-inline">claude plugin uninstall deno-studio@deno</span>, then delete the{' '}
        <span className="m-inline">~/.deno-studio</span> folder and <span className="m-inline">~/.local/bin/studio</span>.
      </>
    ),
  },
];

const TEASER = PLANS.filter((p) => p.id !== 'launch');

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <section className="m-wrap m-hero m-hero--v2">
        <a href="/docs/quickstart" className="m-pill">
          <span className="m-pill__new">NEW</span>
          <span>One command installs Deno in Claude Code</span>
          <span className="m-pill__go">See the guide →</span>
        </a>
        <h1 className="display m-hero__title">Edit your marketing by talking to your AI.</h1>
        <p className="m-hero__sub">
          Deno plugs into the Claude or ChatGPT you already pay for. Say what you want changed in a post, a reel or a
          launch video, and your AI makes the edit, working from your evidence, your voice and licensed media.
        </p>
        <InstallBox id="install" />
        <p className="m-mono m-hero__note">Free to start · No card · No AI credits to buy · Never posts for you</p>
      </section>

      <section className="m-wrap m-mock-wrap" aria-label="Example: editing a launch reel">
        <div className="m-mock" data-play>
          <div className="m-chat">
            <div className="m-chat__head">
              <span>YOUR AI · CLAUDE CODE</span>
              <a href="#install" className="m-chat__ok m-ulink">deno connected</a>
            </div>
            <div className="m-chat__body">
              <div className="m-chat__me">The hook is slow. Cut scene 3 and make the first line land inside 2 seconds.</div>
              <a href="/docs/tools" className="m-chat__calls m-chat__calls--link">
                <div><b>✓</b><span>deno · Read review notes · 3 open</span></div>
                <div><b>✓</b><span>deno · Check copy against Deno&apos;s gates · pass</span></div>
                <div><b>✓</b><span>studio render · on your machine</span></div>
                <div><b>✓</b><span>deno · Save a video version · v4</span></div>
              </a>
              <div className="m-chat__ai">Done. Scene 3 is gone and the hook lands at 1.8 s. Version 4 is on your Deno dashboard with all three notes answered.</div>
            </div>
          </div>

          <div className="m-review">
            <div className="m-review__head">
              <a href="/docs/review" className="m-ulink">DENO REVIEW · LAUNCH REEL</a>
              <span className="m-review__ver">V4 · VIA CLAUDE</span>
            </div>
            <div className="m-frames">
              {FRAMES.map((f) => (
                <div key={f.t} className={`m-frame${f.cls ? ` ${f.cls}` : ''}${f.pin ? ' m-frame--pin' : ''}`} style={f.bg ? { background: f.bg } : undefined}>
                  {f.pin && <i>1</i>}
                  <span>{f.t}</span>
                </div>
              ))}
            </div>
            <div className="m-notes">
              <div><span className="m-chip m-chip--red">00:04</span><span><strong>You:</strong> the logo is too small on this frame.</span></div>
              <div><span className="m-chip m-chip--green">FIXED</span><span><strong>Claude:</strong> the logo is larger from 00:03 to 00:06 in v4.</span></div>
            </div>
            <div className="m-review__foot">
              <span><b>PASS</b> · reads human</span>
              <span><b>PASS</b> · every clip licensed</span>
              <span><b>PASS</b> · no invented numbers</span>
            </div>
          </div>
        </div>
      </section>

      <section className="m-works" aria-label="Works inside">
        <div className="m-wrap m-works__row">
          <span className="m-mono">Works inside</span>
          <a href="/docs/claude-code" className="m-works__app">Claude Code</a>
          <a href="/docs/claude" className="m-works__app">Claude Desktop</a>
          <a href="/docs/claude" className="m-works__app">claude.ai</a>
          <a href="/docs/chatgpt" className="m-works__app">ChatGPT</a>
          <a href="/docs/cursor" className="m-works__app">Cursor</a>
          <a href="/docs/other-clients" className="m-works__more">and any app that speaks MCP →</a>
        </div>
      </section>

      <section id="how" className="m-wrap m-sec">
        <span className="m-label m-label--peach">How it works</span>
        <h2 className="display m-title">You give the notes. Your AI does the edit.</h2>
        <p className="m-sub">No new editor to learn and no timeline to drag. The work happens in the chat you already use, and every version lands on your Deno dashboard.</p>
        <div className="m-grid m-grid--3" data-play>
          <a href="#install" className="m-step m-hit" style={{ background: 'var(--green-soft)' }}>
            <span className="m-step__n">1</span>
            <h3>Install once</h3>
            <p>Paste one line into your terminal, or add Deno in Claude or ChatGPT settings. Sign in once. There is no API key to copy.</p>
            <div className="m-step__eg m-step__eg--code">{INSTALL_CMD}</div>
          </a>
          <a href="/docs/prompts" className="m-step m-hit" style={{ background: 'var(--peach)' }}>
            <span className="m-step__n">2</span>
            <h3>Ask in plain words</h3>
            <p>Your AI reads your idea, your proof and your voice from Deno, then writes the post or builds the video.</p>
            <div className="m-step__eg">&ldquo;Make a 20 second reel about the pain my last validation found.&rdquo;</div>
          </a>
          <a href="/docs/review" className="m-step m-hit" style={{ background: 'var(--blue-soft)' }}>
            <span className="m-step__n">3</span>
            <h3>Review, then say what&apos;s off</h3>
            <p>Press play on your dashboard and type a note. It pins to that frame. Your AI reads the notes and fixes them one by one.</p>
            <div className="m-step__eg"><span className="m-chip m-chip--red">00:04</span><span>&ldquo;Logo is too small here.&rdquo;</span></div>
          </a>
        </div>
      </section>

      <section id="make" className="m-band m-band--ink">
        <div className="m-wrap m-sec">
          <span className="m-label m-label--lime">What you can make</span>
          <h2 className="display m-title">One launch. Every format it needs.</h2>
          <p className="m-sub">Each one starts from a ready prompt inside your AI. Pick one, answer five questions once, approve the treatment.</p>
          <div className="m-grid m-grid--5" data-play>
            <a href="/videos/formats/saas-launch-32" className="m-make m-hit">
              <div className="m-make__art" style={{ background: 'var(--lime)' }}>
                <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="#101613"><path d="M7 4v16l13-8z" /></svg>
              </div>
              <h3>Launch video</h3>
              <p>The film for your launch day, with sound mixed and captions timed.</p>
              <span className="m-make__meta">16:9 · CLAUDE CODE · SEE IT →</span>
            </a>
            <a href="/videos/formats/vertical-feature-15" className="m-make m-hit">
              <div className="m-make__art" style={{ background: 'var(--ink-2)' }}>
                <div style={{ width: '22%', aspectRatio: '9 / 16', background: 'var(--flare)' }} />
              </div>
              <h3>Vertical reel</h3>
              <p>A short hook for Reels, Shorts and TikTok, cut to the beat.</p>
              <span className="m-make__meta">9:16 · CLAUDE CODE · SEE IT →</span>
            </a>
            <a href="/videos/formats/explainer-30" className="m-make m-hit">
              <div className="m-make__art" style={{ background: 'var(--blue-soft)', alignItems: 'flex-end', gap: 4, padding: 14 }}>
                {[30, 70, 45, 90, 55, 35, 75].map((h, i) => (
                  <div key={i} style={{ width: 6, height: `${h}%`, background: 'var(--blue)' }} />
                ))}
              </div>
              <h3>Explainer with voiceover</h3>
              <p>Your script, read by a voice that runs on your machine or your own ElevenLabs key.</p>
              <span className="m-make__meta">16:9 · CLAUDE CODE · SEE IT →</span>
            </a>
            <a href="/videos/formats/carousel-8" className="m-make m-hit">
              <div className="m-make__art" style={{ background: 'var(--peach)' }}>
                <div style={{ width: '20%', aspectRatio: '4 / 5', background: 'var(--ink)' }} />
                <div style={{ width: '20%', aspectRatio: '4 / 5', background: 'var(--paper)', border: '1px solid var(--ink)' }} />
                <div style={{ width: '20%', aspectRatio: '4 / 5', background: 'var(--paper)', border: '1px solid var(--ink)' }} />
              </div>
              <h3>LinkedIn carousel</h3>
              <p>Still pages in your brand colours, each line checked against the slop rules.</p>
              <span className="m-make__meta">4:5 · CLAUDE CODE · SEE IT →</span>
            </a>
            <a href="/docs/posts" className="m-make m-hit">
              <div className="m-make__art" style={{ background: 'var(--amber-soft)', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, padding: 14, alignItems: 'stretch' }}>
                {['var(--ink)', 'var(--amber)', '', 'var(--ink)', '', 'var(--amber)', 'var(--ink)'].map((c, i) => (
                  <div key={i} style={c ? { background: c } : { border: '1px solid var(--ink)' }} />
                ))}
              </div>
              <h3>A week of posts</h3>
              <p>LinkedIn, Reddit, X and Hacker News drafts in your voice, saved to your calendar.</p>
              <span className="m-make__meta">TEXT · ANY AI APP · SEE IT →</span>
            </a>
          </div>
        </div>
      </section>

      <section className="m-wrap m-sec">
        <div className="m-split">
          <div>
            <span className="m-label m-label--blue">The difference</span>
            <h2 className="display m-title">Everyone has the same AI. Yours knows your proof.</h2>
            <p className="m-sub">A plain chatbot guesses what your customers feel and invents a number to sound sure. With Deno connected, your AI works from what real people posted about your problem, and from what you have actually done.</p>
            <a href="/docs/tools" className="link-mono" style={{ marginTop: 24 }}>See all 19 tools your AI gets →</a>
          </div>
          <div className="m-compare">
            <div className="m-compare__row m-compare__row--head"><div>YOUR AI ALONE</div><div>YOUR AI + DENO</div></div>
            {COMPARE.map(([alone, withDeno]) => (
              <div key={alone} className="m-compare__row"><div>{alone}</div><div>{withDeno}</div></div>
            ))}
          </div>
        </div>
        <div className="m-grid m-grid--4" style={{ marginTop: 64 }}>
          <a href="/docs/tools" className="m-stat m-hit" style={{ background: 'var(--green-soft)' }}><b data-count="19">19</b><span>tools your AI can call, plus 5 ready prompts</span></a>
          <a href="/docs/rulebook" className="m-stat m-hit" style={{ background: 'var(--peach)' }}><b data-count="20">20</b><span>slop patterns flagged at the exact words</span></a>
          <a href="/docs/media" className="m-stat m-hit" style={{ background: 'var(--blue-soft)' }}><b>0</b><span>API keys needed to find footage, images and sound</span></a>
          <a href="/docs/auth" className="m-stat m-hit" style={{ background: 'var(--lime)' }}><b>0</b><span>posts, votes or DMs sent for you. You press send.</span></a>
        </div>
      </section>

      <section id="proof" className="m-band m-band--tint">
        <div className="m-wrap m-sec m-split">
          <a href="/docs/validate" className="m-verdict m-hit" data-play>
            <div className="m-verdict__head"><span>EXAMPLE VERDICT</span><span style={{ color: 'var(--muted)' }}>89 POSTS READ</span></div>
            <div className="m-verdict__main">
              <span className="display" style={{ fontSize: 64 }}>PIVOT</span>
              <span className="display" style={{ fontSize: 32, color: 'var(--green)' }}>65%</span>
              <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>confidence, computed from the evidence</span>
            </div>
            <div className="m-verdict__rows">
              <div><span className="m-kept">KEPT</span><span>&ldquo;We tried three tools and still do this in a spreadsheet.&rdquo; <span style={{ color: 'var(--muted)' }}>r/SaaS</span></span></div>
              <div><span className="m-kept">KEPT</span><span>21 claims checked against the post they cite</span></div>
              <div><span className="m-dropped">DROPPED</span><span style={{ color: 'var(--muted)' }}>Claims the judge could not verify</span></div>
            </div>
          </a>
          <div>
            <span className="m-label m-label--amber">Where the proof comes from</span>
            <h2 className="display m-title m-title--sm">First, find out if the idea is worth marketing.</h2>
            <p className="m-sub">Deno reads what people posted about your problem on Reddit, Hacker News, X, LinkedIn, Product Hunt and GitHub. You get Build, Pivot or Kill in under five minutes, and every claim links to its source. That evidence is what your AI writes from.</p>
            <a href="/auth?mode=signup" className="btn btn--ghost" style={{ marginTop: 24 }}>Validate an idea free</a>
          </div>
        </div>
      </section>

      <section className="m-band m-band--lime">
        <div className="m-wrap m-sec m-split m-split--top">
          <div>
            <h2 className="display m-title" style={{ marginTop: 0 }}>We don&apos;t sell AI credits.</h2>
            <p className="m-sub" style={{ color: '#1E2A22', maxWidth: 520 }}>Most AI video tools charge per render. Deno doesn&apos;t. The thinking runs on the Claude or ChatGPT plan you already have, and the rendering runs on your own computer. You pay one flat price for what only Deno has.</p>
            <a href="/pricing" className="btn btn--ink" style={{ marginTop: 28 }}>See pricing</a>
          </div>
          <a href="/pricing" className="m-ledger m-hit" data-play>
            <div><span>The writing and editing</span><b>Your AI plan</b></div>
            <div><span>Rendering the video</span><b>Your computer</b></div>
            <div><span>Your video files</span><b>Stay on your disk</b></div>
            <div className="m-ledger__us"><span>Evidence, voice, rules, media, review</span><b>Deno</b></div>
          </a>
        </div>
      </section>

      <section id="setup" className="m-band m-band--ink">
        <div className="m-wrap m-sec m-split">
          <div>
            <span className="m-label m-label--lime">Set up in 2 minutes</span>
            <h2 className="display m-title">One command. Then just ask.</h2>
            <p className="m-sub">
              The installer does the fiddly parts for you: the plugin, the renderer and the sign-in. Run it again any time
              to update. It skips whatever is already done.
            </p>
            <ul className="m-checks">
              <li>Nothing installs system-wide. The renderer lives in <span className="m-inline">~/.deno-studio</span>.</li>
              <li>You sign in from your browser. No password or key goes in the terminal.</li>
              <li>Your videos render and stay on your own computer.</li>
            </ul>
            <div className="m-hero__actions">
              <a href="#install" className="btn btn--lime">Copy the command</a>
              <a href="/install.sh" className="btn btn--ghost" target="_blank" rel="noopener">Read the script</a>
            </div>
          </div>
          <InstallTerminal />
        </div>
      </section>

      <section id="connect" className="m-band">
        <div className="m-wrap m-sec">
          <span className="m-label m-label--green">Every other way to connect</span>
          <h2 className="display m-title m-title--sm">Prefer your AI to set it up? Paste one prompt.</h2>
          <SetupPrompt />
          <p className="m-mono m-byhand">Or do it by hand</p>
          <SetupTabs />
          <p className="m-fine" style={{ marginTop: 16 }}>
            Building your own agent? The server address is below. <a href="/docs" className="link-mono">Read the docs →</a>
          </p>
          <div style={{ marginTop: 12, maxWidth: 620 }}><CodeBlock code={MCP_URL} /></div>
        </div>
      </section>

      <section id="pricing" className="m-band m-band--tint">
        <div className="m-wrap m-sec">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 }}>
            <div>
              <span className="m-label m-label--blue">Pricing</span>
              <h2 className="display m-title">Start free. Upgrade when you ship.</h2>
            </div>
            <a href="/pricing" className="link-mono">Compare every plan →</a>
          </div>
          <div className="m-plans" style={{ marginTop: 44, gap: 24 }}>
            {TEASER.map((plan) => (
              <div key={plan.id} className={`m-plan${plan.look === 'top' ? ' m-plan--top' : ''}`}>
                <div className="m-plan__name">
                  <span>{plan.name.toUpperCase()}</span>
                  {plan.look === 'top' && <span className="m-plan__badge">MOST POPULAR</span>}
                </div>
                <div className="m-plan__price">
                  <b>${plan.yearly}</b>
                  <span>{plan.monthly === 0 ? 'forever' : 'a month, billed yearly'}</span>
                </div>
                <p style={{ margin: 0, fontSize: 15, color: 'var(--ink-2)' }}>{plan.short}</p>
                <a href={plan.id === 'free' ? planHref(plan) : '/pricing'} className={`btn${plan.look === 'top' ? ' btn--lime' : ''}`} style={{ marginTop: 'auto' }}>{plan.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="m-band">
        <div className="m-wrap m-sec m-split m-split--top">
          <h2 className="display m-title m-title--sm" style={{ marginTop: 0, flex: '1 1 320px' }}>Asked often, answered plainly</h2>
          <div style={{ flex: '2 1 560px' }}>
            <Faq items={FAQ} />
          </div>
        </div>
      </section>

      <section className="m-wrap m-cta">
        <div className="m-cta__box">
          <h2 className="display m-cta__title">Install tonight. Ship the launch video this week.</h2>
          <p>Free to start, no card, and your AI plan does the heavy lifting.</p>
          <div className="m-cta__cmd"><CodeBlock code={INSTALL_CMD} /></div>
          <div className="m-hero__actions">
            <a href="#install" className="btn btn--lime btn--lg">Other systems and apps</a>
            <a href="/docs/quickstart" className="btn btn--ghost btn--lg">Read the setup guide</a>
          </div>
        </div>
      </section>

      <SiteFooter />
      <ScrollReveal />
      <PlayOnView />
    </>
  );
}
