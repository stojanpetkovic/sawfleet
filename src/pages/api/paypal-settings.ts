export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const { data } = await supabaseAdmin.from("payment_settings").select("*").eq("id", 1).maybeSingle();
  // Never send the secret back to the browser, even to an admin — the save
  // form treats a blank secret field as "keep the existing one".
  const { paypal_client_secret, ...safe } = (data || {}) as Record<string, unknown>;
  return json({ ok: true, settings: { ...safe, has_client_secret: Boolean(paypal_client_secret) } });
}

export async function POST({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "invalid_json" }, 400);

  const payload = {
    id: 1,
    paypal_enabled: Boolean(body.paypal_enabled),
    paypal_client_id: typeof body.paypal_client_id === "string" ? body.paypal_client_id.trim() : null,
    paypal_mode: body.paypal_mode === "live" ? "live" : "sandbox",
    updated_at: new Date().toISOString(),
  } as Record<string, unknown>;

  // Secret is optional on save — an empty field means "keep the existing
  // one" so re-saving other fields never blanks out a previously set secret.
  if (typeof body.paypal_client_secret === "string" && body.paypal_client_secret.trim()) {
    payload.paypal_client_secret = body.paypal_client_secret.trim();
  }

  const { error } = await supabaseAdmin.from("payment_settings").upsert(payload);
  return json(error ? { ok: false, error: error.message } : { ok: true }, error ? 500 : 200);
}
