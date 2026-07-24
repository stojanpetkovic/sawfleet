export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail, newLeadEmailHtml } from "../../lib/resend";
import { getPermitAutomationSettings } from "../../lib/permitData";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export async function runNotify(county: string, details: string, origin: string, options: { notifyContractors?: boolean; notifyTruckOwners?: boolean } = {}) {
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

  const results = options.notifyContractors === false ? [] : await Promise.all(
    (contractors || []).map(async (c) => {
      const r = await sendEmail({
        to: c.email,
        subject: `New lead in ${county} — SF Tree Removal`,
        html: newLeadEmailHtml({ companyName: c.company_name, county, details, dashboardUrl }),
      });
      return { email: c.email, ok: r.ok, error: r.ok ? undefined : r.error };
    })
  );

  const { data: matchingTrucks } = await db
    .from("grapple_saw_trucks")
    .select("owner_user_id")
    .eq("location", county)
    .eq("approval_status", "approved")
    .ilike("availability_status", "available")
    .not("owner_user_id", "is", null);

  const ownerIds = Array.from(new Set((matchingTrucks || []).map((truck: any) => truck.owner_user_id).filter(Boolean)));
  let truckOwners: any[] = [];
  if (ownerIds.length > 0) {
    const { data } = await db
      .from("truck_owners")
      .select("id,company_name,email")
      .in("id", ownerIds)
      .eq("status", "approved")
      .not("email", "is", null);
    truckOwners = data || [];
  }
  const truckDashboardUrl = `${origin}/truck-dashboard`;
  const truckOwnerResults = options.notifyTruckOwners === false ? [] : await Promise.all(
    truckOwners.map(async (owner) => {
      const result = await sendEmail({
        to: owner.email,
        subject: `Equipment opportunity in ${county} — SF Tree Removal`,
        html: newLeadEmailHtml({
          companyName: owner.company_name || "Fleet partner",
          county,
          details: "A matching job is available for an equipment support application.",
          dashboardUrl: truckDashboardUrl,
        }),
      });
      return { email: owner.email, ok: result.ok, error: result.ok ? undefined : result.error };
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
      contractors_matched_active_with_email: options.notifyContractors === false ? 0 : contractors?.length || 0,
      truck_owners_matched_approved_with_email: options.notifyTruckOwners === false ? 0 : truckOwners.length,
      send_results: results,
      truck_owner_send_results: truckOwnerResults,
    },
  };
}

export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const { county, details } = await request.json();
    const origin = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const settings = await getPermitAutomationSettings();
    const { status, body } = await runNotify(county, details, origin, {
      notifyContractors: settings.notifyContractorsOnPublish,
      notifyTruckOwners: settings.notifyTruckOwnersOnPublish,
    });
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
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

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
