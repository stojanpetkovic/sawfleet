export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

const excludedPrefixes = ["/admin", "/api", "/dashboard", "/portal", "/login", "/register", "/reset-password", "/truck-dashboard", "/truck-login"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function clean(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength) || null;
}

export async function POST({ request }: { request: Request }) {
  if (!supabaseAdmin) return json({ ok: false }, 503);

  const body = await request.json().catch(() => null);
  const path = clean(body?.path, 500);
  if (!path || !path.startsWith("/") || excludedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return json({ ok: true, tracked: false });
  }

  const { error } = await supabaseAdmin.from("frontend_page_views").insert([{
    path,
    page_title: clean(body?.title, 250),
    session_id: clean(body?.sessionId, 100),
    referrer: clean(body?.referrer, 1000),
    utm_source: clean(body?.utmSource, 150),
    utm_medium: clean(body?.utmMedium, 150),
    utm_campaign: clean(body?.utmCampaign, 250),
    user_agent: clean(request.headers.get("user-agent"), 500),
  }]);

  if (error) {
    console.error("Page view tracking failed", error.message);
    return json({ ok: false }, 500);
  }
  return json({ ok: true, tracked: true });
}

