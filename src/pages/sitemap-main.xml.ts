export const prerender = false;

const BASE = "https://sftreeremoval.com";
const NOW = new Date().toISOString();

function xmlEscape(value: string) {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] || c
  );
}

function url(loc: string, priority: string, freq: string, lastmod = NOW) {
  return `  <url><loc>${xmlEscape(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;
}

export async function GET() {
  // Statičke stranice
  const staticUrls = [
    url(`${BASE}/`,                      "1.0", "daily"),
    url(`${BASE}/permit-leads`,          "0.9", "daily"),
    url(`${BASE}/contractors`,           "0.7", "weekly"),
    url(`${BASE}/privacy`,               "0.3", "yearly"),
    url(`${BASE}/terms`,                 "0.3", "yearly"),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
