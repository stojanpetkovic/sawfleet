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

  const { data } = await supabaseAdmin.from("account_security_settings").select("*").eq("id", 1).maybeSingle();
  return json({ ok: true, settings: data });
}

export async function POST({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "invalid_json" }, 400);

  const payload = {
    id: 1,
    email_verification_required: Boolean(body.email_verification_required),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("account_security_settings").upsert(payload);
  return json(error ? { ok: false, error: error.message } : { ok: true, settings: payload }, error ? 500 : 200);
}
