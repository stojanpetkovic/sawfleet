export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getPermitLeads, getPermitAutomationSettings } from "../../lib/permitData";

/**
 * Autonomous permit lead scraping and sync to external_leads table.
 * This is the primary data source for the permit leads dashboard.
 * Called by: cron jobs, manual triggers, or automated systems
 */
export async function POST() {
  try {
    console.log(`[PERMIT SYNC] Starting permit lead synchronization at ${new Date().toISOString()}`);

    // Get automation settings
    const settings = await getPermitAutomationSettings();

    if (!settings.enabled) {
      console.log("[PERMIT SYNC] Automation disabled");
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Automation disabled",
          synced: 0,
          created: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch new permits from scraping source (all available, not just 'new' status)
    console.log("[PERMIT SYNC] Fetching permits from scraping source...");
    const permits = await getPermitLeads(1000, true);
    console.log(`[PERMIT SYNC] Found ${permits.length} permits from source`);

    // Get existing permits in permit_leads (excluding archived)
    const { data: existingLeads } = await supabaseAdmin
      .from('permit_leads')
      .select("owner_email, owner_phone, permit_number")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    const existingEmails = new Set(
      (existingLeads || [])
        .map((l: any) => l.owner_email?.toLowerCase())
        .filter((e: any) => e)
    );
    const existingPhones = new Set(
      (existingLeads || [])
        .map((l: any) => l.owner_phone?.toLowerCase())
        .filter((e: any) => e)
    );
    const existingPermits = new Set(
      (existingLeads || [])
        .map((l: any) => l.permit_number?.toLowerCase())
        .filter((p: any) => p)
    );

    // Filter and transform new permits
    const toInsert = permits
      .filter((permit) => {
        // Check territory filter
        if (settings.allowedTerritories.length > 0) {
          const allowed = settings.allowedTerritories.some((territory) => {
            const normalizedTerritory = territory.toLowerCase();
            const normalizedJurisdiction =
              (permit.jurisdiction || "").toLowerCase();
            return (
              normalizedJurisdiction.includes(normalizedTerritory) ||
              normalizedTerritory.includes(normalizedJurisdiction)
            );
          });
          if (!allowed) return false;
        }

        // Check score threshold
        if ((permit.lead_score || 0) < settings.minScore) {
          return false;
        }

        // Check if duplicate by email, phone, or permit number
        const isDuplicate =
          (permit.owner_email &&
            existingEmails.has(permit.owner_email.toLowerCase())) ||
          (permit.owner_phone &&
            existingPhones.has(permit.owner_phone.toLowerCase())) ||
          (permit.permit_number &&
            existingPermits.has(permit.permit_number.toLowerCase()));

        return !isDuplicate;
      })
      .map((permit) => {
        // Generate placeholder email if no email or phone exists
        let email = permit.owner_email || null;
        if (!email && !permit.owner_phone) {
          // Use permit number as unique identifier for placeholder email
          email = `permit-${permit.permit_number || Math.random().toString(36).substring(7)}@permit.local`;
        }
        return {
          owner_name: permit.owner_name || null,
          owner_email: email,
          owner_phone: permit.owner_phone || null,
          owner_mailing_address: permit.owner_mailing_address || null,
          permit_type: permit.permit_type || null,
          address: permit.address || null,
          jurisdiction: permit.jurisdiction || null,
          permit_description: permit.permit_description || null,
          permit_date: permit.permit_date || null,
          permit_number: permit.permit_number || null,
          lead_score: permit.lead_score || 0,
          source_name: permit.source_name || "scraped",
          source_url: permit.source_url || null,
          discovered_at: permit.discovered_at || new Date().toISOString(),
          permit_status: settings.autoApprove ? "converted" : "new",
          assigned_to: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

    console.log(
      `[PERMIT SYNC] Ready to insert ${toInsert.length} new permits (${permits.length - toInsert.length} duplicates)`
    );

    if (toInsert.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: "No new permits to sync",
          synced: 0,
          created: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert new permits
    const { error: insertError, data: inserted } = await supabaseAdmin
      .from('permit_leads')
      .insert(toInsert)
      .select();

    if (insertError) {
      console.error("[PERMIT SYNC] Insert failed:", insertError);
      throw insertError;
    }

    // Log activity
    const insertedCount = inserted?.length || 0;
    console.log(
      `[PERMIT SYNC] Successfully inserted ${insertedCount} permits`
    );

    // Create activity log entries
    if (insertedCount > 0) {
      const logs = inserted.map((permit: any) => ({
        permit_lead_id: permit.id,
        action: `Permit lead scraped from ${permit.jurisdiction || "unknown territory"}`,
        changed_by: "permit_scraper",
        created_at: new Date().toISOString(),
      }));

      await supabaseAdmin.from('permit_lead_logs').insert(logs);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Synced ${insertedCount} new permits`,
        synced: insertedCount,
        created: insertedCount,
        skipped: permits.length - insertedCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[PERMIT SYNC] Sync failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Sync failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Use POST to trigger permit sync",
      instructions: "curl -X POST http://localhost:4321/api/permit-sync",
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
