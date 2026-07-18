export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

// CORS — ovo namerno prima pozive sa DRUGIH domena (spoljni sajtovi
// šalju svoje forme ovde), pa je Access-Control-Allow-Origin otvoren.
// Ako kasnije poželiš da ograničiš na tačno određene domene, ovde je
// mesto — zameni "*" sa proverom protiv liste dozvoljenih domena.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!supabaseAdmin) {
      return json({ error: "service_role_not_configured" }, 500);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "invalid_json" }, 400);

    // Honeypot — skriveno polje koje pravi ljudi nikad ne popune, ali
    // botovi često upišu nešto u svako polje forme. Ako je popunjeno,
    // tiho odbijamo (ne javljamo botu da smo ga prepoznali).
    if (body.website || body.hp_field) {
      return json({ ok: true }, 200);
    }

    const {
      formType,       // 'lead' | 'job' (job stiže kasnije)
      sourceDomain,   // koji sajt šalje — ako nije poslat, uzimamo iz Origin/Referer header-a
      fullName,
      email,
      phone,
      message,
      smsConsent,
      smsConsentText,
      extra,          // slobodna torba za polja specifična za formu (npr. buduća "job" forma)
    } = body;

    if (!fullName || (!email && !phone)) {
      return json({ error: "invalid_input", message: "Full name and at least one of email/phone are required." }, 400);
    }

    const origin = request.headers.get("origin") || request.headers.get("referer") || "";
    let resolvedDomain = sourceDomain || null;
    if (!resolvedDomain && origin) {
      try { resolvedDomain = new URL(origin).hostname; } catch { /* ignore */ }
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    const { error } = await supabaseAdmin.from("external_leads").insert([{
      form_type: formType || "lead",
      source_domain: resolvedDomain,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      message: message || null,
      sms_consent: !!smsConsent,
      sms_consent_text: smsConsentText || null,
      status: "new",
      extra: extra || null,
      ip_address: ip,
      user_agent: userAgent,
    }]);

    if (error) {
      return json({ error: "insert_failed", message: error.message }, 500);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "unexpected_error", message: String(err) }, 500);
  }
}
