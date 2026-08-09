// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://sftreeremoval.com',
  // Every internal link and the hand-built /sitemap.xml (sitemap.xml.ts +
  // sitemap-*.xml.ts) use no-trailing-slash URLs. Without pinning this,
  // Astro serves both /page and /page/ as 200s that each self-canonicalize
  // — Google saw that as duplicate content with conflicting canonicals.
  trailingSlash: 'never',

  vite: {
    plugins: [tailwindcss()]
  },

  // NOTE: the @astrojs/sitemap integration used to run here too, producing
  // a SECOND, independent sitemap (/sitemap-index.xml -> /sitemap-0.xml)
  // with trailing-slash URLs that overlapped the hand-built /sitemap.xml
  // (sitemap-main/-trucks/-blog.xml, no trailing slash) submitted to
  // Search Console. Two sitemaps disagreeing on the canonical URL format
  // for the same pages is exactly what Search Console flagged. Removed —
  // the hand-built sitemap is the actively maintained one.
  integrations: [],

  adapter: node({
    mode: 'standalone'
  })
});