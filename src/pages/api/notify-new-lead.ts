export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail, newLeadEmailHtml } from "../../lib/resend";

async function runNotify(county: string, details: string, origin: string) {
  if (!county) {
    return { status: 400, body: { error: "county is required" } };
  }

  // Ova ruta se poziva server-to-server (fetch iz admin panela ka
  // sopstvenom API-ju) — nema korisničke sesije u ovom kontekstu, pa
  // anon klijent uvek dobija 0 redova od RLS-a. Service role je
  // ispravan izbor ovde (isti obrazac kao admin/[id].astro strane).
  const db = supabaseAdmin ?? supabase;

  // Dijagnostika: koliko kontraktora uopšte postoji za tu teritoriju,
  // BEZ obzira na status/email — da vidimo da li je problem u
  // poklapanju teritorije ili u statusu/email-u.
  const { data: allInTerritory } = await db
    .from("contractors")
    .select("company_name, email, status, territory")
    .eq("territory", county);

  const { data: contractors, error } = await db
    .from("contractors")
    .select("company_name, email")
    .eq("territory", county)
    .eq("status", "active")
    .not("email", "is", null);

  if (error) {
    console.error(error);
    return { status: 500, body: { error: "db_error", details: error.message } };
  }

  const dashboardUrl = `${origin}/dashboard`;

  const results = await Promise.all(
    (contractors || []).map(async (c) => {
      const r = await sendEmail({
        to: c.email,
        subject: `New lead in ${county} — SF Tree Removal`,
        html: newLeadEmailHtml({ companyName: c.company_name, county, details, dashboardUrl }),
      });
      return { email: c.email, ok: r.ok, error: r.ok ? undefined : r.error };
    })
  );

  const hasResendKey = !!import.meta.env.RESEND_API_KEY;

  return {
    status: 200,
    body: {
      county_received: county,
      resend_api_key_present: hasResendKey,
      contractors_in_territory_any_status: (allInTerritory || []).map((c) => ({
        company_name: c.company_name,
        status: c.status,
        has_email: !!c.email,
      })),
      contractors_matched_active_with_email: contractors?.length || 0,
      send_results: results,
    },
  };
}

export async function POST({ request }: { request: Request }) {
  try {
    const { county, details } = await request.json();
    const origin = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const { status, body } = await runNotify(county, details, origin);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error", message: String(err) }), { status: 500 });
  }
}

// GET za brzo ručno testiranje iz browsera:
// /api/notify-new-lead?county=Broward&details=Test
export async function GET({ request }: { request: Request }) {
  try {
    const url = new URL(request.url);
    const county = url.searchParams.get("county") || "";
    const details = url.searchParams.get("details") || "Test lead";
    const origin = import.meta.env.PUBLIC_SITE_URL || url.origin;
    const { status, body } = await runNotify(county, details, origin);
    return new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error", message: String(err) }), { status: 500 });
  }
}