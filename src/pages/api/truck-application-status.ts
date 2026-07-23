export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";
import { sendEmail } from "../../lib/resend";

export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized || !supabaseAdmin) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
    }
    const { applicationId, status } = await request.json().catch(() => ({}));
    if (!applicationId || !["accepted", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_input" }), { status: 400 });
    }
    const { data: application, error } = await supabaseAdmin
      .from("truck_lead_applications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", applicationId)
      .select("id,lead_id,truck_owner_id")
      .single();
    if (error) throw error;
    await supabaseAdmin.from("lead_logs").insert([{
      lead_id: application.lead_id,
      action: `Truck owner application ${status}`,
      changed_by: authorization.actor || "admin",
    }]);
    const { data: owner } = await supabaseAdmin.from("truck_owners").select("company_name,email").eq("id", application.truck_owner_id).maybeSingle();
    if (owner?.email) {
      const dashboardUrl = `${import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin}/truck-dashboard`;
      await sendEmail({
        to: owner.email,
        subject: `Equipment application ${status} — SF Tree Removal`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px"><p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#2563eb;font-weight:bold">Fleet opportunity</p><h1 style="font-size:22px;color:#0f172a">Your application was ${status}</h1><p style="color:#475569;line-height:1.6">Hi ${owner.company_name || "fleet partner"}, dispatch has updated your equipment support application.</p><a href="${dashboardUrl}" style="display:inline-block;margin-top:12px;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">Open dashboard →</a></div>`,
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "unexpected_error" }), { status: 500 });
  }
}
