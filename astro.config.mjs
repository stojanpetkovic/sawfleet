// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// City pages that used to live at the site root. The real pages are under
// /areas/; the old addresses redirect there so they never compete with them.
const movedCityPages = {
  '/fort-lauderdale-tree-removal/': '/areas/fort-lauderdale-tree-removal/',
  '/miami-tree-removal/': '/areas/miami-tree-removal/',
  '/hollywood-tree-service/': '/areas/hollywood-tree-service/',
  '/pembroke-pines-tree-removal/': '/areas/pembroke-pines-tree-removal/',
  '/boca-raton-tree-removal/': '/areas/boca-raton-tree-removal/',
};

export default defineConfig({
  site: 'https://sftreeremoval.com',
  trailingSlash: 'always',
  // Astro 7's default compression drops the space between text and an inline
  // link that sits on the next line ("call us<a>…"). Keep the HTML as written.
  compressHTML: false,
  redirects: movedCityPages,
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/thank-you/') && !Object.keys(movedCityPages).some((path) => page.endsWith(path)),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
