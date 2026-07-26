export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const GET: APIRoute = async ({ request }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const [{ data: rules, error: rulesError }, { data: contractors, error: contractorsError }, { data: truckOwners, error: truckOwnersError }] = await Promise.all([
    supabaseAdmin.from("external_lead_routing").select("*").order("source_domain", { ascending: true }),
    supabaseAdmin.from("contractors").select("user_id, company_name, contact_name").eq("status", "active").order("company_name", { ascending: true }),
    supabaseAdmin.from("truck_owners").select("id, company_name, contact_name").eq("status", "approved").order("company_name", { ascending: true }),
  ]);

  if (rulesError) return json({ ok: false, error: rulesError.message }, 500);
  if (contractorsError) return json({ ok: false, error: contractorsError.message }, 500);
  if (truckOwnersError) return json({ ok: false, error: truckOwnersError.message }, 500);

  return json({ ok: true, rules: rules || [], contractors: contractors || [], truckOwners: truckOwners || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const body = await request.json().catch(() => null);
  const sourceDomain = typeof body?.source_domain === "string" ? body.source_domain.trim().toLowerCase() : "";
  const enabled = body?.enabled !== false;
  const contractorIds = Array.isArray(body?.contractor_ids) ? body.contractor_ids.filter((v: unknown) => typeof v === "string") : [];
  const truckOwnerIds = Array.isArray(body?.truck_owner_ids) ? body.truck_owner_ids.filter((v: unknown) => typeof v === "string") : [];

  if (!sourceDomain) {
    return json({ ok: false, error: "source_domain is required" }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from("external_lead_routing")
    .upsert(
      { source_domain: sourceDomain, enabled, contractor_ids: contractorIds, truck_owner_ids: truckOwnerIds, updated_at: new Date().toISOString() },
      { onConflict: "source_domain" }
    )
    .select()
    .single();

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, rule: data });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const id = url.searchParams.get("id");
  if (!id) return json({ ok: false, error: "id is required" }, 400);

  const { error } = await supabaseAdmin.from("external_lead_routing").delete().eq("id", id);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
