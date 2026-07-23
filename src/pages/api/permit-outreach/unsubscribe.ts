export const prerender = false;
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
async function suppress(token: string | null) {
  if (!token || !supabaseAdmin) return false;
  const { data } = await supabaseAdmin.from("permit_outreach_events").select("email").eq("tracking_token", token).maybeSingle();
  if (!data?.email) return false;
  await supabaseAdmin.from("permit_outreach_events").update({
    status: "unsubscribed", unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).ilike("email", data.email);
  return true;
}
export async function GET({ url }: { url: URL }) {
  const ok = await suppress(url.searchParams.get("token"));
  return new Response(`<!doctype html><html><body style="font-family:Arial;padding:48px;color:#0f172a"><h1>${ok ? "You have been unsubscribed." : "This unsubscribe link is invalid."}</h1><p>${ok ? "We will not send further permit outreach to this email address." : "No preferences were changed."}</p></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
export async function POST({ url }: { url: URL }) {
  const ok = await suppress(url.searchParams.get("token"));
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400, headers: { "Content-Type": "application/json" } });
}

