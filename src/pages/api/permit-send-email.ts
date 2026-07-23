import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { buildPermitOutreachEmail, getPermitAutomationSettings } from "../../lib/permitData";
import { sendEmail } from "../../lib/resend";

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!supabaseAdmin) return new Response(JSON.stringify({ ok: false, error: "service_role_not_configured" }), { status: 500 });
    const { leadId } = await request.json().catch(() => ({}));
    if (!leadId) return new Response(JSON.stringify({ ok: false, error: "Missing leadId" }), { status: 400 });

    const { data: lead, error } = await supabaseAdmin.from("permit_leads").select("*").eq("id", leadId).single();
    if (error || !lead?.owner_email) return new Response(JSON.stringify({ ok: false, error: "Permit opportunity not found or has no email" }), { status: 404 });

    const settings = await getPermitAutomationSettings();
    const siteUrl = new URL("/api/permit-click", import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin);
    siteUrl.searchParams.set("token", lead.outreach_token);

    const details = [lead.permit_type, lead.address, lead.permit_description, lead.permit_number ? `Permit ${lead.permit_number}` : null].filter(Boolean).join(" • ");
    const email = buildPermitOutreachEmail({
      fullName: lead.owner_name || "there",
      permitDetails: details,
      siteUrl: siteUrl.toString(),
      settings,
    });
    const emailResult = await sendEmail({ to: lead.owner_email, subject: email.subject, html: email.html });
    if (!emailResult.ok) {
      await supabaseAdmin.from("permit_leads").update({
        outreach_attempts: Number(lead.outreach_attempts || 0) + 1,
        outreach_last_error: String(emailResult.error || "Email delivery failed"),
      }).eq("id", leadId);
      return new Response(JSON.stringify({ ok: false, error: emailResult.error }), { status: 500 });
    }

    const sentAt = new Date().toISOString();
    await supabaseAdmin.from("permit_leads").update({
      permit_status: "invited",
      outreach_sent_at: sentAt,
      outreach_attempts: Number(lead.outreach_attempts || 0) + 1,
      outreach_last_error: null,
    }).eq("id", leadId);
    await supabaseAdmin.from("permit_lead_logs").insert([{
      permit_lead_id: leadId,
      action: `Outreach email sent to ${lead.owner_email}`,
      changed_by: "permit_outreach",
      created_at: sentAt,
    }]);
    return new Response(JSON.stringify({ ok: true, messageId: emailResult.data?.id }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("permit email failed", error);
    return new Response(JSON.stringify({ ok: false, error: error?.message || "unexpected_error" }), { status: 500 });
  }
};
