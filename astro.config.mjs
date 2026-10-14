// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Addresses that used to exist. City pages moved under /areas/; the contractor
// and truck directory of the previous site are gone, and only the old blog posts
// and pages with a real equivalent are redirected. Anything else returns 404.
const movedPages = {
  '/fort-lauderdale-tree-removal/': '/areas/fort-lauderdale-tree-removal/',
  '/miami-tree-removal/': '/areas/miami-tree-removal/',
  '/hollywood-tree-service/': '/areas/hollywood-tree-service/',
  '/pembroke-pines-tree-removal/': '/areas/pembroke-pines-tree-removal/',
  '/boca-raton-tree-removal/': '/areas/boca-raton-tree-removal/',
  '/blog/how-sf-tree-removal-works-from-request-to-a-local-contractor-9ac2e6f7/': '/how-it-works/',
  '/blog/tree-removal-costs-in-south-florida-what-actually-drives-the-7a9e6b60/': '/tree-care-guides/tree-removal-cost-south-florida/',
  '/blog/8-warning-signs-a-tree-on-your-property-needs-to-be-removed-aeb08ad7/': '/tree-care-guides/signs-a-tree-needs-to-be-removed/',
  '/blog/hurricane-season-tree-prep-what-to-do-before-the-storm-hits-b08b8e84/': '/tree-care-guides/hurricane-tree-preparation/',
  '/blog/': '/tree-care-guides/',
  '/services/': '/tree-services/',
  '/service-areas/': '/areas/',
  '/privacy/': '/privacy-policy/',
  '/support/': '/contact-us/',
};

// A page's lastmod is the date of the last commit that touched its source file,
// so the sitemap only claims a change when there was one.
function lastCommit(url) {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, '');
  const file = [`src/pages/${path}/index.astro`, `src/pages/${path}.astro`, 'src/pages/index.astro'].find(
    (f) => path !== '' || f.endsWith('pages/index.astro') ? existsSync(f) : false,
  );
  if (!file) return undefined;
  try {
    const out = execSync(`git log -1 --format=%cI -- "${file}"`, { encoding: 'utf8' }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

export default defineConfig({
  site: 'https://sftreeremoval.com',
  trailingSlash: 'always',
  // Astro 7's default compression drops the space between text and an inline
  // link that sits on the next line ("call us<a>…"). Keep the HTML as written.
  compressHTML: false,
  redirects: movedPages,
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/thank-you/') && !Object.keys(movedPages).includes(new URL(page).pathname),
      serialize: (item) => ({ ...item, lastmod: lastCommit(item.url) }),
    }),
  ],
  // Self-hosted fonts through Astro's font optimizer: no render-blocking request
  // to Google and no layout shift while they load.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Lexend',
      cssVariable: '--font-display',
      weights: ['500', '600', '700', '800'],
      styles: ['normal'],
    },
    {
      provider: fontProviders.google(),
      name: 'Inter',
      cssVariable: '--font-body',
      weights: ['400', '500', '600', '700'],
      styles: ['normal'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
