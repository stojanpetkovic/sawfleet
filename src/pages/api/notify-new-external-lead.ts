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
  photoUrls?: string[];
};

export async function notifyNewExternalLead(payload: ExternalLeadNotifyPayload, siteUrl: string) {
  const { fullName, email, phone, message, sourceDomain, formType, photoUrls } = payload;

  // Server-to-server poziv, nema korisničke sesije — service role
  // (isti razlog kao ostale notify-* rute).
  const db = supabaseAdmin ?? supabase;

  // Prvo probaj podešene adrese iz Settings -> Notifications. "job"
  // (npr. Community Assistance Program prijave) ima SVOJU odvojenu
  // listu adresa, sve ostalo ("lead") ide na opštu listu.
  const { data: settings } = await db
    .from("tracking_settings")
    .select("external_lead_notification_emails, job_lead_notification_emails")
    .eq("id", 1)
    .single();

  const configuredField = formType === "job" ? settings?.job_lead_notification_emails : settings?.external_lead_notification_emails;

  let recipients: string[] = (configuredField || "")
    .split(",")
    .map((e: string) => e.trim())
    .filter(Boolean);

  // Fallback: ako specifična lista za "job" nije podešena, probaj
  // opštu external-lead listu pre nego što padneš na sve admine.
  if (recipients.length === 0 && formType === "job") {
    recipients = (settings?.external_lead_notification_emails || "")
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean);
  }

  // Ako i dalje ništa nije podešeno, javi svim adminima (isto kao ostale notify-* rute)
  if (recipients.length === 0) {
    const { data: admins } = await db.rpc("get_admin_emails");
    recipients = (admins || []).map((a: { email: string }) => a.email);
  }

  if (recipients.length === 0) {
    return { sent: 0, message: "No recipients configured." };
  }

  const photosHtml = photoUrls && photoUrls.length > 0
    ? `<div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;">
        ${photoUrls.map((url) => `<a href="${url}" target="_blank"><img src="${url}" width="90" height="90" style="object-fit:cover; border-radius:8px; border:1px solid #E2E8F0;" /></a>`).join("")}
      </div>`
    : "";

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: formType === "job"
          ? `New Community Assistance Program application from ${sourceDomain || "unknown site"}`
          : `New external lead from ${sourceDomain || "unknown site"}`,
        html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
          <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#0D9488; font-weight:bold; margin:0 0 12px;">// ${formType === "job" ? "Assistance Program Application" : "External Lead"}</p>
          <h1 style="font-size:22px; margin:0 0 16px;">${formType === "job" ? "New assistance program application" : `New lead from ${sourceDomain || "an external site"}`}</h1>
          <p style="color:#475569; font-size:14px; line-height:1.6;"><strong>${fullName || "Unnamed"}</strong> submitted a ${formType === "job" ? "Community Assistance Program" : "lead"} form from ${sourceDomain || "an external site"}.</p>
          <p style="color:#64748B; font-size:13px; line-height:1.6; border-left:2px solid #E2E8F0; padding-left:12px;">
            ${[email, phone].filter(Boolean).join(" · ") || "No contact info"}<br/>
            ${message ? message.slice(0, 140) : ""}
          </p>
          ${photosHtml}
          <a href="${siteUrl}/admin/external-leads" style="display:inline-block; margin-top:20px; background:#0D9488; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Review application →</a>
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
