import type { MetadataRoute } from 'next';
import { DOCS, docHref } from '@/lib/docs/content';
import { FORMATS, VIDEOS, formatHref, videoHref } from '@/lib/gallery';
import { SITE_URL } from '@/lib/site';

/** Every public page, for search engines. The dashboard and auth pages are left out (see robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    priority,
    ...(lastModified ? { lastModified } : {}),
  });
  return [
    page('/', 1),
    page('/pricing', 0.8),
    page('/videos', 0.9),
    page('/videos/submit', 0.4),
    ...FORMATS.map((f) => page(formatHref(f.slug), 0.7)),
    ...VIDEOS.map((v) => page(videoHref(v.slug), 0.7, v.published)),
    ...DOCS.map((d) => page(docHref(d.slug), 0.5)),
  ];
}
