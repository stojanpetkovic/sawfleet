export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getPermitAutomationSettings } from "../../lib/permitData";
import { publishWebsiteLead } from "../../lib/leadWorkflow";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
    if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);
    const body = await request.json().catch(() => null);
    if (!body?.originType || !body?.originId || !body?.county) return json({ ok: false, error: "originType, originId and county are required" }, 400);

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    if (body.originType === "external") {
      const { data: external, error } = await supabaseAdmin.from("external_leads").select("*").eq("id", body.originId).single();
      if (error || !external) return json({ ok: false, error: "external_lead_not_found" }, 404);
      if (external.website_lead_id) return json({ ok: true, created: false, leadId: external.website_lead_id });

      const result = await publishWebsiteLead({
        originType: "external",
        originId: external.id,
        county: body.county,
        email: external.email,
        phone: external.phone,
        details: external.message,
        source: external.source_domain || "external",
        siteUrl,
        customerSubmitted: true,
      });
      await supabaseAdmin.from("external_leads").update({
        status: "published",
        website_lead_id: result.lead.id,
        published_at: new Date().toISOString(),
      }).eq("id", external.id);
      return json({ ok: true, created: result.created, leadId: result.lead.id });
    }

    if (body.originType === "permit_dispatch") {
      const settings = await getPermitAutomationSettings();
      if (settings.permitManualPublishRequiresConfirmation && body.confirmUnrequested !== true) {
        return json({ ok: false, error: "explicit_confirmation_required" }, 409);
      }
      const { data: permit, error } = await supabaseAdmin.from("permit_leads").select("*").eq("id", body.originId).single();
      if (error || !permit) return json({ ok: false, error: "permit_not_found" }, 404);
      if (permit.website_lead_id) return json({ ok: true, created: false, leadId: permit.website_lead_id });

      const result = await publishWebsiteLead({
        originType: "permit_dispatch",
        originId: permit.id,
        county: body.county,
        email: permit.owner_email,
        phone: permit.owner_phone,
        details: [permit.permit_type, permit.address, permit.permit_description, permit.permit_number ? `Permit ${permit.permit_number}` : null].filter(Boolean).join(" • "),
        source: "permit_dispatch",
        siteUrl,
        customerSubmitted: false,
      });
      await supabaseAdmin.from("permit_leads").update({
        permit_status: "published",
        website_lead_id: result.lead.id,
        converted_at: new Date().toISOString(),
      }).eq("id", permit.id);
      await supabaseAdmin.from("permit_lead_logs").insert([{
        permit_lead_id: permit.id,
        action: `Dispatcher manually published unconfirmed opportunity as Website Lead ${result.lead.id}`,
        changed_by: "dispatcher",
      }]);
      return json({ ok: true, created: result.created, leadId: result.lead.id });
    }

    return json({ ok: false, error: "unsupported_origin_type" }, 400);
  } catch (error: any) {
    console.error("publish lead failed", error);
    return json({ ok: false, error: error?.message || "unexpected_error" }, 500);
  }
}
