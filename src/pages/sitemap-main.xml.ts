export const prerender = false;

import { supabaseAdmin } from "../lib/supabaseAdmin";
import { supabase } from "../lib/supabase";

const db = supabaseAdmin ?? supabase;
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
    url(`${BASE}/services`,              "0.8", "monthly"),
    url(`${BASE}/service-areas`,         "0.8", "monthly"),
    url(`${BASE}/contractors`,           "0.9", "daily"),
    url(`${BASE}/contractors-registration`, "0.7", "monthly"),
    url(`${BASE}/truck-directory`,       "0.8", "weekly"),
    url(`${BASE}/truck-registration`,    "0.6", "monthly"),
    url(`${BASE}/compliance`,            "0.5", "monthly"),
    url(`${BASE}/privacy`,               "0.3", "yearly"),
    url(`${BASE}/terms`,                 "0.3", "yearly"),
    url(`${BASE}/support`,               "0.4", "monthly"),
  ];

  // Dinamički contractor profili
  const { data: contractors } = await db
    .from("contractors")
    .select("slug, status, is_public")
    .eq("status", "active")
    .eq("is_public", true);

  const contractorUrls = (contractors || [])
    .filter((c: any) => c.slug)
    .map((c: any) =>
      url(`${BASE}/contractors/${xmlEscape(c.slug)}`, "0.7", "weekly")
    );

  const allUrls = [...staticUrls, ...contractorUrls];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
