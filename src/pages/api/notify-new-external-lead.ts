export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail } from "../../lib/resend";

type ExternalLeadNotifyPayload = {
  fullName?: string;
  email?: string;
  phone?: string;
  message?: string;
  sourceDomain?: string;
  formType?: string;
};

export async function notifyNewExternalLead(payload: ExternalLeadNotifyPayload, siteUrl: string) {
  const { fullName, email, phone, message, sourceDomain, formType } = payload;

  // Server-to-server poziv, nema korisničke sesije — service role
  // (isti razlog kao ostale notify-* rute).
  const db = supabaseAdmin ?? supabase;

  // Prvo probaj podešene adrese iz Settings -> Notifications
  const { data: settings } = await db
    .from("tracking_settings")
    .select("external_lead_notification_emails")
    .eq("id", 1)
    .single();

  let recipients: string[] = (settings?.external_lead_notification_emails || "")
    .split(",")
    .map((e: string) => e.trim())
    .filter(Boolean);

  // Ako ništa nije podešeno, javi svim adminima (isto kao ostale notify-* rute)
  if (recipients.length === 0) {
    const { data: admins } = await db.rpc("get_admin_emails");
    recipients = (admins || []).map((a: { email: string }) => a.email);
  }

  if (recipients.length === 0) {
    return { sent: 0, message: "No recipients configured." };
  }

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `New external lead from ${sourceDomain || "unknown site"}`,
        html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
          <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#0D9488; font-weight:bold; margin:0 0 12px;">// External Lead</p>
          <h1 style="font-size:22px; margin:0 0 16px;">New lead from ${sourceDomain || "an external site"}</h1>
          <p style="color:#475569; font-size:14px; line-height:1.6;"><strong>${fullName || "Unnamed"}</strong> submitted a ${formType === "job" ? "job" : "lead"} form.</p>
          <p style="color:#64748B; font-size:13px; line-height:1.6; border-left:2px solid #E2E8F0; padding-left:12px;">
            ${[email, phone].filter(Boolean).join(" · ") || "No contact info"}<br/>
            ${message ? message.slice(0, 140) : ""}
          </p>
          <a href="${siteUrl}/admin/external-leads" style="display:inline-block; margin-top:8px; background:#0D9488; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Review lead →</a>
        </div>`,
      })
    )
  );

  return { sent: results.filter((r) => r.ok).length, recipients };
}

export async function POST({ request }: { request: Request }) {
  try {
    const payload = await request.json();
    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const result = await notifyNewExternalLead(payload, siteUrl);
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error", message: String(err) }), { status: 500 });
  }
}
