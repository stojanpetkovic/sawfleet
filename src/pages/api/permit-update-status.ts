export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export const POST: APIRoute = async ({ request }) => {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
    }
    if (!supabaseAdmin) return new Response(JSON.stringify({ ok: false, error: "service_role_not_configured" }), { status: 500 });
    const { leadId, status } = await request.json().catch(() => ({}));
    const validStatuses = ["new", "qualified", "invited", "responded", "published", "converted", "skipped", "expired"];
    if (!leadId || !validStatuses.includes(status)) return new Response(JSON.stringify({ ok: false, error: "Invalid leadId or status" }), { status: 400 });
    const { data, error } = await supabaseAdmin.from("permit_leads").update({ permit_status: status, updated_at: new Date().toISOString() }).eq("id", leadId).select().single();
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    await supabaseAdmin.from("permit_lead_logs").insert([{
      permit_lead_id: leadId,
      action: `Permit opportunity status changed to ${status}`,
      changed_by: "dispatcher",
    }]);
    return new Response(JSON.stringify({ ok: true, lead: data }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "unexpected_error" }), { status: 500 });
  }
};
