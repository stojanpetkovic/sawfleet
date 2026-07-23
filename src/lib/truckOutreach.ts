import { supabaseAdmin } from "./supabaseAdmin";
import { sendEmail } from "./resend";

export const DEFAULT_TRUCK_OUTREACH_TEMPLATE = `<p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#16803C;font-weight:bold;">// Free equipment profile</p>
<h1 style="font-size:24px;margin:12px 0;color:#0f172a;">Your company is listed in our truck directory</h1>
<p style="color:#475569;line-height:1.65;">Hi {{contactName}}, we created a free public equipment profile for <strong>{{companyName}}</strong> from publicly available business information.</p>
<p style="color:#475569;line-height:1.65;">Claim it at no cost to verify the details, manage your equipment information and receive relevant opportunities from contractors who need fleet support.</p>
<p><a href="{{claimUrl}}" style="display:inline-block;background:#16803C;color:white;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:bold;">Review and claim your profile →</a></p>
<p style="font-size:12px;color:#64748b;">Equipment: {{equipmentName}} · Location: {{location}}</p>`;

export async function getTruckOutreachSettings() {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.from("truck_outreach_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}

function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function render(template: string, profile: any, claimUrl: string) {
  const values: Record<string, string> = {
    contactName: escapeHtml(profile.contact_name || "there"),
    companyName: escapeHtml(profile.company_name),
    equipmentName: escapeHtml(profile.equipment_name),
    location: escapeHtml([profile.location_city, profile.location_state].filter(Boolean).join(", ") || "Not listed"),
    claimUrl,
  };
  return (template || DEFAULT_TRUCK_OUTREACH_TEMPLATE).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || "");
}

export async function runTruckOutreachBatch({ force = false }: { force?: boolean } = {}) {
  if (!supabaseAdmin) return { ok: false, error: "service_role_not_configured", sent: 0 };
  const settings = await getTruckOutreachSettings();
  if (!settings || (!settings.enabled && !force)) return { ok: true, skipped: "disabled", sent: 0 };

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: sentToday } = await supabaseAdmin
    .from("truck_profile_outreach")
    .select("id", { count: "exact", head: true })
    .gte("sent_at", startOfDay.toISOString())
    .in("status", ["sent", "delivered", "opened", "clicked"]);
  const remaining = Math.max(0, Number(settings.daily_limit) - Number(sentToday || 0));
  if (!remaining) return { ok: true, skipped: "daily_limit_reached", sent: 0 };

  const [{ data: profiles }, { data: history }] = await Promise.all([
    supabaseAdmin.from("unclaimed_truck_directory")
      .select("id,slug,company_name,contact_name,equipment_name,location_city,location_state,source_payload,profile_status,is_published")
      .eq("profile_status", "unclaimed").eq("is_published", true).order("created_at").limit(1000),
    supabaseAdmin.from("truck_profile_outreach")
      .select("profile_id,email,status,sent_at,created_at").order("created_at", { ascending: false }).limit(5000),
  ]);

  const baseUrl = import.meta.env.PUBLIC_SITE_URL || "https://sftreeremoval.com";
  const cooldownMs = Number(settings.cooldown_days) * 86400000;
  const candidates: { profile: any; email: string }[] = [];
  const batchEmails = new Set<string>();

  for (const profile of profiles || []) {
    const email = String(profile.source_payload?.public_email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || batchEmails.has(email)) continue;
    const emailHistory = (history || []).filter((row: any) => String(row.email).toLowerCase() === email);
    if (emailHistory.some((row: any) => ["bounced", "complained", "unsubscribed"].includes(row.status))) continue;
    const profileHistory = (history || []).filter((row: any) => row.profile_id === profile.id);
    if (profileHistory.length >= Number(settings.max_attempts)) continue;
    const lastSent = profileHistory.find((row: any) => row.sent_at);
    if (lastSent && Date.now() - new Date(lastSent.sent_at).getTime() < cooldownMs) continue;
    candidates.push({ profile, email });
    batchEmails.add(email);
    if (candidates.length >= remaining) break;
  }

  let sent = 0;
  let failed = 0;
  for (const { profile, email } of candidates) {
    const { data: log, error: logError } = await supabaseAdmin.from("truck_profile_outreach")
      .insert([{ profile_id: profile.id, email, status: "queued" }]).select().single();
    if (logError || !log) { failed++; continue; }
    const claimUrl = new URL(`/truck-registration?claim=${encodeURIComponent(profile.slug)}`, baseUrl);
    claimUrl.searchParams.set("utm_source", "truck_profile_outreach");
    claimUrl.searchParams.set("utm_medium", "email");
    claimUrl.searchParams.set("outreach", log.tracking_token);
    const openUrl = new URL("/api/truck-outreach/open", baseUrl);
    openUrl.searchParams.set("token", log.tracking_token);
    const clickUrl = new URL("/api/truck-outreach/click", baseUrl);
    clickUrl.searchParams.set("token", log.tracking_token);
    clickUrl.searchParams.set("to", claimUrl.toString());
    const unsubscribeUrl = new URL("/api/truck-outreach/unsubscribe", baseUrl);
    unsubscribeUrl.searchParams.set("token", log.tracking_token);
    const html = `<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto;padding:28px;border:1px solid #e2e8f0;border-radius:16px">${render(settings.email_template, profile, clickUrl.toString())}<p style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:11px;color:#94a3b8;">You received this one-to-one business profile notice because a public company email was associated with this listing. <a href="${unsubscribeUrl}" style="color:#64748b;">Do not contact me again</a>.</p><img src="${openUrl}" width="1" height="1" alt="" style="display:none" /></div>`;
    const result: any = await sendEmail({
      to: email,
      subject: settings.subject,
      html,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      tags: [{ name: "category", value: "truck-profile-outreach" }],
    });
    if (result.ok) {
      sent++;
      await supabaseAdmin.from("truck_profile_outreach").update({
        status: "sent", sent_at: new Date().toISOString(), resend_email_id: result.data?.id || null, updated_at: new Date().toISOString(),
      }).eq("id", log.id);
    } else {
      failed++;
      await supabaseAdmin.from("truck_profile_outreach").update({
        status: "failed", error_message: String(result.error || "Send failed").slice(0, 1000), updated_at: new Date().toISOString(),
      }).eq("id", log.id);
    }
  }
  return { ok: true, sent, failed, eligible: candidates.length, remainingAfterRun: remaining - sent };
}

