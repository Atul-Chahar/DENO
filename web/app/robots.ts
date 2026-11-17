import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** Public pages may be crawled; the dashboard, sign-in and the API rewrite may not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app/', '/auth', '/oauth/', '/api/', '/welcome', '/forgot'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
