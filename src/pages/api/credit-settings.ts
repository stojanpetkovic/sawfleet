export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getCreditSettings } from "../../lib/creditSystem";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export async function GET({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const settings = await getCreditSettings();
  return new Response(JSON.stringify({ ok: true, settings }), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ ok: false, error: "service_role_not_configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const payload = {
    id: 1,
    enabled: Boolean(body.enabled),
    contractor_lead_cost: Math.max(0, Math.round(Number(body.contractor_lead_cost) || 0)),
    truck_lead_cost: Math.max(0, Math.round(Number(body.truck_lead_cost) || 0)),
    auto_refill_enabled: Boolean(body.auto_refill_enabled),
    auto_refill_amount: Math.max(0, Math.round(Number(body.auto_refill_amount) || 0)),
    auto_refill_interval_days: Math.max(1, Math.round(Number(body.auto_refill_interval_days) || 30)),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("credit_settings").upsert(payload);
  return new Response(JSON.stringify(error ? { ok: false, error: error.message } : { ok: true, settings: payload }), {
    status: error ? 500 : 200,
    headers: { "Content-Type": "application/json" },
  });
}
