import { ImageResponse } from 'next/og';

/** The picture shown when someone shares a Deno link on X, LinkedIn, Slack or WhatsApp. */
export const alt = 'Deno: edit your marketing by talking to your AI. One command installs it in Claude Code.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const INK = '#101613';
const PAPER = '#FAF8F3';
const LIME = '#C6F24E';
const SOFT = '#C9D2CD';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: INK, color: PAPER, padding: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>deno</span>
          <span style={{ fontSize: 18, fontWeight: 700, background: LIME, color: INK, padding: '4px 10px' }}>GTM</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2, maxWidth: 980 }}>
            Edit your marketing by talking to your AI.
          </div>
          <div style={{ fontSize: 28, color: SOFT, maxWidth: 940 }}>
            Posts, reels and launch videos from real evidence, in your voice, with licensed media.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, border: `2px solid ${LIME}`, padding: '18px 24px', fontSize: 26, fontFamily: 'monospace', boxShadow: `10px 10px 0 ${LIME}`, background: '#1A221E' }}>
          <span style={{ color: LIME, fontWeight: 700 }}>$</span>
          <span>curl -fsSL deno-web-eight.vercel.app/install.sh | bash</span>
        </div>
      </div>
    ),
    size,
  );
}
