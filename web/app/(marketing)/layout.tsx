import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { FontLinks } from '@/components/FontLinks';
import '@/styles/base.css';
import '@/styles/landing.css';
import '@/styles/site.css';

export const metadata: Metadata = {
  title: 'Deno — Edit your marketing by talking to your AI',
  description:
    'Deno plugs into Claude, ChatGPT and any MCP app. Your AI writes and edits your posts, reels and launch videos from real evidence, in your voice, with licensed media. One flat price, no AI credits.',
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
