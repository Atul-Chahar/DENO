import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { FontLinks } from '@/components/FontLinks';
import { SITE_URL } from '@/lib/site';
import '@/styles/base.css';
import '@/styles/landing.css';
import '@/styles/site.css';

const TITLE = 'Deno — Edit your marketing by talking to your AI';
const DESCRIPTION =
  'Deno plugs into Claude, ChatGPT and any MCP app. Your AI writes and edits your posts, reels and launch videos from real evidence, in your voice, with licensed media. One command installs it.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pages that set their own title should set openGraph.title too; the share image is shared by all of them.
  openGraph: { type: 'website', siteName: 'Deno' },
  twitter: { card: 'summary_large_image' },
  title: TITLE,
  description: DESCRIPTION,
};

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Reading the request makes the page dynamic, so every response gets a fresh CSP nonce.
  await headers();
  return (
    <html lang="en">
      <head>
        <FontLinks />
      </head>
      <body>{children}</body>
    </html>
  );
}
