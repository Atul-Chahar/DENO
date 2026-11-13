/**
 * Content-Security-Policy with a per-request script nonce (Next.js applies it to
 * its own scripts when the request carries `x-nonce`).
 *
 * `style-src 'unsafe-inline'` is deliberate: the pixel-perfect port keeps the
 * original markup's inline `style` attributes, which nonces can't cover. Script
 * execution — the real XSS vector — is nonce + strict-dynamic only.
 */
export function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const connect = ["'self'", supabase, supabase.replace(/^https:/, 'wss:')].filter(Boolean).join(' ');
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Studio posters, contact sheets and review copies are signed URLs on Supabase Storage (docs/18).
    `img-src 'self' data: blob:${supabase ? ` ${supabase}` : ''}`,
    // The MP4s stay on the founder's disk; a review can play their own unlisted link (R2, a tunnel: any https).
    `media-src 'self' blob: https:${supabase ? ` ${supabase}` : ''}`,
    'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}
