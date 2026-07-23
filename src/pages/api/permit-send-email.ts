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
    const normalizedEmail = String(lead.owner_email).trim().toLowerCase();
    const { data: history } = await supabaseAdmin.from("permit_outreach_events")
      .select("status,sent_at").ilike("email", normalizedEmail).order("created_at", { ascending: false }).limit(50);
    if ((history || []).some((row: any) => ["bounced", "complained", "unsubscribed"].includes(row.status))) {
      return new Response(JSON.stringify({ ok: false, error: "This address is suppressed due to bounce, complaint or unsubscribe." }), { status: 409 });
    }
    const lastSent = (history || []).find((row: any) => row.sent_at);
    if (lastSent && Date.now() - new Date(lastSent.sent_at).getTime() < settings.permitEmailCooldownDays * 86400000) {
      return new Response(JSON.stringify({ ok: false, error: `Cooldown active. Wait ${settings.permitEmailCooldownDays} days between messages.` }), { status: 409 });
    }
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: sentToday } = await supabaseAdmin.from("permit_outreach_events")
      .select("id", { count: "exact", head: true }).gte("sent_at", startOfDay.toISOString())
      .in("status", ["sent", "delivered", "opened", "clicked", "converted"]);
    if (Number(sentToday || 0) >= settings.permitDailyEmailLimit) {
      return new Response(JSON.stringify({ ok: false, error: "Daily permit outreach limit reached." }), { status: 429 });
    }
    if (Number(lead.outreach_attempts || 0) >= settings.permitMaxEmailAttempts) {
      return new Response(JSON.stringify({ ok: false, error: "Maximum outreach attempts reached." }), { status: 409 });
    }
    const { data: event, error: eventError } = await supabaseAdmin.from("permit_outreach_events")
      .insert([{ permit_lead_id: lead.id, email: normalizedEmail, status: "queued" }]).select().single();
    if (eventError || !event) return new Response(JSON.stringify({ ok: false, error: eventError?.message || "Could not create outreach event" }), { status: 500 });
    const siteUrl = new URL("/api/permit-click", import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin);
    siteUrl.searchParams.set("token", lead.outreach_token);
    siteUrl.searchParams.set("event", event.tracking_token);
    const openUrl = new URL("/api/permit-outreach/open", siteUrl.origin);
    openUrl.searchParams.set("token", event.tracking_token);
    const unsubscribeUrl = new URL("/api/permit-outreach/unsubscribe", siteUrl.origin);
    unsubscribeUrl.searchParams.set("token", event.tracking_token);

    const details = [lead.permit_type, lead.address, lead.permit_description, lead.permit_number ? `Permit ${lead.permit_number}` : null].filter(Boolean).join(" • ");
    const email = buildPermitOutreachEmail({
      fullName: lead.owner_name || "there",
      permitDetails: details,
      siteUrl: siteUrl.toString(),
      settings,
    });
    const trackedHtml = `${email.html}<p style="font:11px Arial;color:#94a3b8;margin-top:24px">This is a one-to-one notice about public permit information. <a href="${unsubscribeUrl}">Do not contact me again</a>.</p><img src="${openUrl}" width="1" height="1" alt="" style="display:none">`;
    const emailResult: any = await sendEmail({
      to: lead.owner_email, subject: email.subject, html: trackedHtml,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "category", value: "permit-outreach" }],
    });
    if (!emailResult.ok) {
      await supabaseAdmin.from("permit_outreach_events").update({ status: "failed", error_message: String(emailResult.error || "Email delivery failed"), updated_at: new Date().toISOString() }).eq("id", event.id);
      await supabaseAdmin.from("permit_leads").update({
        outreach_attempts: Number(lead.outreach_attempts || 0) + 1,
        outreach_last_error: String(emailResult.error || "Email delivery failed"),
      }).eq("id", leadId);
      return new Response(JSON.stringify({ ok: false, error: emailResult.error }), { status: 500 });
    }

    const sentAt = new Date().toISOString();
    await supabaseAdmin.from("permit_outreach_events").update({ status: "sent", sent_at: sentAt, resend_email_id: emailResult.data?.id || null, updated_at: sentAt }).eq("id", event.id);
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
