export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail } from "../../lib/resend.js";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Schedule a follow-up reminder for a customer.
// Admin calls this (e.g. when marking a job complete).
// Also has a GET endpoint for the cron to send due emails.
export async function POST({ request }: { request: Request }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return json({ error: "unauthenticated" }, 401);
  if (!supabaseAdmin) return json({ error: "service_role_not_configured" }, 500);

  const { data: isAdmin } = await supabaseAdmin.rpc("is_admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const { customerId, leadId, monthsFromNow = 12, type = "annual_reminder", subject, message } = body;
  if (!customerId) return json({ error: "customerId required" }, 400);

  const scheduledFor = new Date();
  scheduledFor.setMonth(scheduledFor.getMonth() + Number(monthsFromNow));

  const { error } = await supabaseAdmin.from("customer_followups").insert([{
    customer_id: customerId,
    lead_id: leadId || null,
    type,
    subject: subject || null,
    message: message || null,
    scheduled_for: scheduledFor.toISOString().split("T")[0],
    status: "pending",
    created_by: session.user.email,
  }]);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, scheduledFor: scheduledFor.toISOString().split("T")[0] });
}

// GET — called by cron to send due follow-up emails
export async function GET({ request }: { request: Request }) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = import.meta.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!supabaseAdmin) return json({ error: "service_role_not_configured" }, 500);

  const today = new Date().toISOString().split("T")[0];

  // Get all pending follow-ups due today or earlier
  const { data: due } = await supabaseAdmin
    .from("customer_followups")
    .select("id, customer_id, lead_id, type, subject, message, scheduled_for, customers(email, full_name)")
    .eq("status", "pending")
    .lte("scheduled_for", today)
    .limit(50);

  let sent = 0;
  const errors: string[] = [];

  for (const fup of due || []) {
    const customer = (fup as any).customers;
    if (!customer?.email) continue;

    const name = customer.full_name ? customer.full_name.split(" ")[0] : "there";
    const subject = (fup as any).subject || "Time for your annual tree service check-up";
    const message = (fup as any).message ||
      `Hi ${name},<br><br>It's been about a year since your last tree service request. Trees grow fast in South Florida — a trim or inspection now can prevent bigger issues later.<br><br>Submit a new request and we'll connect you with a local contractor.`;

    const html = `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;background:#fff;padding:32px;border-radius:16px;border:1px solid #e7eae8;">
        <p style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#16803c;font-weight:bold;margin:0 0 12px;">// Annual reminder</p>
        <h1 style="font-size:20px;margin:0 0 16px;">${subject}</h1>
        <p style="color:#475569;font-size:14px;line-height:1.6;">${message}</p>
        <a href="https://sftreeremoval.com/#request" style="display:inline-block;margin-top:24px;background:#22c55e;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;padding:12px 24px;border-radius:10px;">Get a free quote →</a>
        <p style="margin-top:24px;font-size:11px;color:#94a3b8;">
          You're receiving this because you previously requested tree service from SF Tree Removal.<br>
          <a href="https://sftreeremoval.com/my-account" style="color:#16803c;">View your account</a>
        </p>
      </div>`;

    const result = await sendEmail({ to: customer.email, subject, html });

    if (result.ok) {
      await supabaseAdmin
        .from("customer_followups")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", fup.id);
      sent++;
    } else {
      errors.push(`${fup.id}: ${result.error}`);
    }
  }

  return json({ ok: true, sent, errors });
}
