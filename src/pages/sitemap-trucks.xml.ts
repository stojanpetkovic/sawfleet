export const prerender = false;

import { supabase } from "../lib/supabase";
import { directoryLocationSlug } from "../lib/truckDirectory";

function xmlEscape(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[char] || char);
}

export async function GET() {
  const { data: profiles } = await supabase
    .from("unclaimed_truck_directory")
    .select("slug,location_city,location_state,updated_at")
    .eq("is_published", true)
    .neq("profile_status", "hidden");

  const baseUrl = "https://sftreeremoval.com";
  const urls = new Map<string, string>();
  urls.set(`${baseUrl}/truck-directory`, new Date().toISOString());
  for (const profile of profiles || []) {
    urls.set(`${baseUrl}/truck-directory/profile/${encodeURIComponent(profile.slug)}`, profile.updated_at);
    const state = directoryLocationSlug(profile.location_state);
    const city = directoryLocationSlug(profile.location_city);
    if (state) urls.set(`${baseUrl}/truck-directory/locations/${state}`, profile.updated_at);
    if (state && city) urls.set(`${baseUrl}/truck-directory/locations/${state}/${city}`, profile.updated_at);
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls.entries()].map(([url, lastmod]) =>
    `  <url><loc>${xmlEscape(url)}</loc><lastmod>${new Date(lastmod).toISOString()}</lastmod></url>`
  ).join("\n")}\n</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
