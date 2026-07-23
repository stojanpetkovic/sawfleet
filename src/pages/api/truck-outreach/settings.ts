export const prerender = false;

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { DEFAULT_TRUCK_OUTREACH_TEMPLATE, getTruckOutreachSettings } from "../../../lib/truckOutreach";
import { authorizeAutomationRequest } from "../../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function GET({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  const settings = await getTruckOutreachSettings();
  if (!settings) return json({ ok: false, error: "settings_not_available" }, 500);
  const { data: activity } = await supabaseAdmin!.from("truck_profile_outreach")
    .select("id,email,status,sent_at,delivered_at,opened_at,clicked_at,created_at,unclaimed_truck_directory(company_name)")
    .order("created_at", { ascending: false }).limit(20);
  return json({ ok: true, settings: { ...settings, email_template: settings.email_template || DEFAULT_TRUCK_OUTREACH_TEMPLATE }, activity: activity || [] });
}

export async function POST({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "invalid_json" }, 400);
  const payload = {
    id: 1,
    enabled: Boolean(body.enabled),
    daily_limit: Math.min(100, Math.max(1, Number(body.daily_limit) || 10)),
    cooldown_days: Math.min(365, Math.max(3, Number(body.cooldown_days) || 14)),
    max_attempts: Math.min(5, Math.max(1, Number(body.max_attempts) || 2)),
    subject: String(body.subject || "").trim().slice(0, 200) || "Claim your free SF Tree Removal equipment profile",
    email_template: String(body.email_template || "").trim() || DEFAULT_TRUCK_OUTREACH_TEMPLATE,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from("truck_outreach_settings").upsert(payload);
  return error ? json({ ok: false, error: error.message }, 500) : json({ ok: true, settings: payload });
}
