export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

export async function GET({ request }: { request: Request }) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token") || "";
  const eventToken = requestUrl.searchParams.get("event") || "";
  const destination = new URL("/", import.meta.env.PUBLIC_SITE_URL || requestUrl.origin);
  destination.searchParams.set("utm_source", "permit_outreach");
  destination.searchParams.set("utm_medium", "email");
  if (token) destination.searchParams.set("permit_ref", token);

  if (token && supabaseAdmin) {
    const { data: permit } = await supabaseAdmin.from("permit_leads").select("id,permit_status").eq("outreach_token", token).maybeSingle();
    if (permit) {
      await supabaseAdmin.from("permit_leads").update({
        outreach_clicked_at: new Date().toISOString(),
        permit_status: permit.permit_status === "converted" ? "converted" : "responded",
      }).eq("id", permit.id);
      await supabaseAdmin.from("permit_lead_logs").insert([{
        permit_lead_id: permit.id,
        action: "Homeowner clicked the permit outreach link",
        changed_by: "permit_outreach",
      }]);
    }
  }
  if (eventToken && supabaseAdmin) {
    await supabaseAdmin.from("permit_outreach_events").update({
      status: "clicked", clicked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("tracking_token", eventToken).not("status", "in", '("bounced","complained","unsubscribed")');
  }
  return Response.redirect(destination.toString(), 302);
}
