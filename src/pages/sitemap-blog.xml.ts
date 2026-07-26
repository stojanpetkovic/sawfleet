export const prerender = false;

import { supabase } from "../lib/supabase";

function xmlEscape(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  })[char] || char);
}

export async function GET() {
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug,updated_at")
    .eq("status", "published");

  const baseUrl = "https://sftreeremoval.com";
  const urls = new Map<string, string>();
  urls.set(`${baseUrl}/blog`, new Date().toISOString());
  for (const post of posts || []) {
    urls.set(`${baseUrl}/blog/${encodeURIComponent(post.slug)}`, post.updated_at);
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
