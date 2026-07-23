export const prerender = false;
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET({ url }: { url: URL }) {
  const token = url.searchParams.get("token");
  const fallback = new URL("/truck-registration", url.origin);
  let destination = fallback;
  try {
    const requested = new URL(url.searchParams.get("to") || "", url.origin);
    if (requested.origin === url.origin || requested.hostname === "sftreeremoval.com") destination = requested;
  } catch {}
  if (token && supabaseAdmin) {
    await supabaseAdmin.from("truck_profile_outreach").update({
      status: "clicked", clicked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("tracking_token", token).not("status", "in", '("bounced","complained","unsubscribed")');
  }
  return Response.redirect(destination, 302);
}

