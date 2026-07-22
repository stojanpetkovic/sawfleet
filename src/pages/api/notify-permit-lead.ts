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
    const action = String(body.action || "email").toLowerCase();
    const db = supabaseAdmin ?? supabase;

    let leadId = body.leadId || null;
    let existingLead: any = null;

    if (leadId) {
      const { data } = await db.from("leads").select("*").eq("id", leadId).maybeSingle();
      existingLead = data;
    }

    if (!existingLead && email) {
      const { data } = await db.from("leads").select("*").eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
      existingLead = data;
    }

    const statusByAction: Record<string, string> = {
      email: "invited",
      invite: "invited",
      responded: "responded",
      converted: "converted",
    };
    const nextStatus = statusByAction[action] || "invited";

    const actionTextByAction: Record<string, string> = {
      email: `Permit outreach email sent to ${email}`,
      invite: `Permit lead invited to request work through the website`,
      responded: `Permit lead responded to outreach`,
      converted: `Permit lead marked as converted`,
    };
    const logAction = actionTextByAction[action] || `Permit activity recorded for ${email}`;

    if (action === "email") {
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
    }

    if (existingLead?.id) {
      await db.from("leads").update({ status: nextStatus }).eq("id", existingLead.id);
      await db.from("lead_logs").insert([{ lead_id: existingLead.id, action: logAction, changed_by: "permit_outreach" }]);
    } else {
      const { data: createdLead } = await db.from("leads").insert([{
        email,
        county: body.territory || null,
        details: permitDetails,
        status: nextStatus,
        source: "permit_outreach",
        created_at: new Date().toISOString(),
      }]).select("id").single();

      if (createdLead?.id) {
        await db.from("lead_logs").insert([{ lead_id: createdLead.id, action: logAction, changed_by: "permit_outreach" }]);
      }
    }

    return json({ ok: true, sent: action === "email", status: nextStatus });
  } catch (error) {
    console.error("notify-permit-lead failed", error);
    return json({ ok: false, error: String(error) }, 500);
  }
}
