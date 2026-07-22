export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail, permitLeadOutreachEmailHtml } from "../../lib/resend";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => null);
    if (!body?.email) {
      return json({ ok: false, error: "email_required" }, 400);
    }

    const fullName = body.fullName || "there";
    const email = body.email;
    const permitDetails = body.permitDetails || body.message || "Permit opportunity";
    const siteUrl = body.siteUrl || import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

    const html = permitLeadOutreachEmailHtml({
      fullName,
      permitDetails,
      siteUrl,
    });

    const result = await sendEmail({
      to: email,
      subject: "We can help with your permit project",
      html,
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 500);
    }

    const db = supabaseAdmin ?? supabase;
    if (body.leadId) {
      const { data: currentLead } = await db.from("external_leads").select("extra").eq("id", body.leadId).single();
      const extra = currentLead?.extra || {};
      await db.from("external_leads").update({
        status: "contacted",
        extra: {
          ...extra,
          outreach_sent_at: new Date().toISOString(),
          outreach_subject: "We can help with your permit project",
        },
      }).eq("id", body.leadId);
    }

    try {
      const { data: existingLead } = await db.from("leads").select("id").eq("email", email).limit(1).single();
      const leadId = existingLead?.id || null;
      if (leadId) {
        await db.from("lead_logs").insert([{ lead_id: leadId, action: `Permit outreach email sent to ${email}`, changed_by: "permit_outreach" }]);
      } else {
        const { data: createdLead } = await db.from("leads").insert([{
          email,
          county: body.territory || null,
          details: permitDetails,
          status: "new",
          source: "permit_outreach",
          created_at: new Date().toISOString(),
        }]).select("id").single();

        if (createdLead?.id) {
          await db.from("lead_logs").insert([{ lead_id: createdLead.id, action: `Permit outreach email sent to ${email}`, changed_by: "permit_outreach" }]);
        }
      }
    } catch (logError) {
      console.error("permit outreach logging failed", logError);
    }

    return json({ ok: true, sent: true });
  } catch (error) {
    console.error("notify-permit-lead failed", error);
    return json({ ok: false, error: String(error) }, 500);
  }
}
