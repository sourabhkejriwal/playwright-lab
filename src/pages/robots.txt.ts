import type { APIRoute } from 'astro';
import { url } from '../lib/url';

// An endpoint rather than a file in public/, because the sitemap line needs the deployed absolute URL.
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL(url('sitemap-index.xml'), site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
