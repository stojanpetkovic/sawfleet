export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getPermitAutomationSettings } from "../../lib/permitData";
import { publishWebsiteLead } from "../../lib/leadWorkflow";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);
    const body = await request.json().catch(() => null);
    if (!body) return json({ ok: false, error: "invalid_json" }, 400);
    if (body.website || body.hp_field) return json({ ok: true });

    const county = String(body.county || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    if (!county || (!email && !phone)) return json({ ok: false, error: "county_and_contact_required" }, 400);

    const settings = await getPermitAutomationSettings();
    let permit: any = null;
    const permitToken = String(body.permitRef || "").trim();
    if (permitToken) {
      const { data } = await supabaseAdmin.from("permit_leads").select("*").eq("outreach_token", permitToken).maybeSingle();
      permit = data;
    }

    const result = await publishWebsiteLead({
      originType: "website",
      county,
      email,
      phone,
      details: body.details,
      source: permit ? "permit_outreach" : String(body.source || "website"),
      siteUrl: new URL(request.url).origin,
      customerSubmitted: body.customerSubmitted !== false,
      makeAvailable: settings.frontendAutoPublish,
      attribution: body.attribution && typeof body.attribution === "object" ? body.attribution : null,
    });

    if (permit && result.lead?.id) {
      await supabaseAdmin.from("permit_leads").update({
        permit_status: "converted",
        website_lead_id: result.lead.id,
        converted_at: new Date().toISOString(),
      }).eq("id", permit.id);
      await supabaseAdmin.from("permit_outreach_events").update({
        status: "converted",
        updated_at: new Date().toISOString(),
      }).eq("permit_lead_id", permit.id).not("status", "in", '("bounced","complained","unsubscribed")');
      await supabaseAdmin.from("permit_lead_logs").insert([{
        permit_lead_id: permit.id,
        action: `Homeowner submitted a request and converted to Website Lead ${result.lead.id}`,
        changed_by: "website_form",
      }]);
    }

    return json({ ok: true, leadId: result.lead?.id, created: result.created, duplicate: result.duplicate || null });
  } catch (error: any) {
    console.error("website lead submission failed", error);
    return json({ ok: false, error: error?.message || "unexpected_error" }, 500);
  }
}
