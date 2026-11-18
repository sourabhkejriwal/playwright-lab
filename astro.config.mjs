// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// SITE_URL / BASE_PATH are set by the GitHub Pages workflow (actions/configure-pages).
// Locally they default to the dev server root.
export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
  integrations: [react(), mdx(), sitemap()],
  markdown: {
    // Syntax colors come from --astro-code-* vars in src/styles/tokens.css (all WCAG AA).
    shikiConfig: { theme: 'css-variables' },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
