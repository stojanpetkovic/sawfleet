export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

/**
 * Migrates all permit leads from 'leads' table (source=permit_automation)
 * to 'permit_leads' table for unified permit lead management.
 * Run once: POST /api/migrate-to-external-leads
 */
export async function POST() {
  try {
    // Get all permit leads from leads table
    const { data: leads, error: fetchError } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("source", "permit_automation")
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    const leadsCount = leads?.length || 0;
    console.log(`Migrating ${leadsCount} permit leads to external_leads...`);

    if (leadsCount === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No leads to migrate", migrated: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Transform leads to permit_leads format
    const permitLeads = (leads || [])
      .filter(
        (lead: any) =>
          String(lead.email || "").trim() || String(lead.phone || "").trim()
      )
      .map((lead: any) => ({
        owner_name: lead.name || null,
        owner_email: lead.email || null,
        owner_phone: lead.phone || null,
        owner_mailing_address: null,
        permit_type: lead.details?.split(" • ")[0] || null,
        address: lead.details?.split(" • ")[1] || null,
        jurisdiction: lead.county || null,
        permit_description: lead.details || null,
        permit_date: null,
        permit_number:
          lead.details?.match(/Permit\s+([A-Za-z0-9-]+)/)?.[1] || null,
        lead_score: 0,
        source_name: "permit_automation",
        source_url: null,
        discovered_at: lead.created_at,
        permit_status: "new",
        assigned_to: null,
        created_at: lead.created_at,
        updated_at: new Date().toISOString(),
      }));

    // Insert into permit_leads (skip existing by email/phone)
    const { data: existing } = await supabaseAdmin
      .from("permit_leads")
      .select("owner_email, owner_phone");

    const existingEmails = new Set(
      (existing || [])
        .map((e: any) => e.owner_email)
        .filter((e: any) => e)
    );
    const existingPhones = new Set(
      (existing || [])
        .map((e: any) => e.owner_phone)
        .filter((e: any) => e)
    );

    const toInsert = permitLeads.filter(
      (lead: any) =>
        !(
          (lead.owner_email && existingEmails.has(lead.owner_email)) ||
          (lead.owner_phone && existingPhones.has(lead.owner_phone))
        )
    );

    console.log(`${toInsert.length} new leads to insert, ${permitLeads.length - toInsert.length} duplicates skipped`);

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "All leads already exist in permit_leads",
          migrated: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("permit_leads")
      .insert(toInsert);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Successfully migrated ${toInsert.length} permit leads to permit_leads`,
        migrated: toInsert.length,
        skipped: permitLeads.length - toInsert.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Migration failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Migration failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Use POST to migrate leads",
      instructions: "curl -X POST http://localhost:4321/api/migrate-to-external-leads",
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
