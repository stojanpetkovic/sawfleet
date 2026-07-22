export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getPermitAutomationSettings } from "../../lib/permitData";

/**
 * Cron job to automatically archive old permits
 * Archives permits older than archiveDays setting and with status 'new' (never contacted)
 * Called by: cron scheduler or manual trigger
 */
export async function POST() {
  try {
    console.log(`[ARCHIVE CRON] Starting permit archival at ${new Date().toISOString()}`);

    // Get automation settings
    const settings = await getPermitAutomationSettings();

    if (!settings.enabled) {
      console.log("[ARCHIVE CRON] Automation disabled");
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Automation disabled",
          archived: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const archiveDays = settings.archiveDays || 60;
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - archiveDays);

    console.log(`[ARCHIVE CRON] Archiving permits older than ${archiveDate.toISOString()} (${archiveDays} days)`);

    // Archive old permits that are still in 'new' status (never contacted)
    const { data: archivedLeads, error: archiveError } = await supabaseAdmin
      .from("permit_leads")
      .update({
        archived_at: new Date().toISOString(),
        archive_reason: `Auto-archived after ${archiveDays} days of inactivity`,
      })
      .eq("permit_status", "new")
      .lt("created_at", archiveDate.toISOString())
      .is("archived_at", null)
      .select();

    if (archiveError) {
      console.error("[ARCHIVE CRON] Archive failed:", archiveError);
      throw archiveError;
    }

    const archivedCount = archivedLeads?.length || 0;
    console.log(`[ARCHIVE CRON] Archived ${archivedCount} permits`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Archived ${archivedCount} permits older than ${archiveDays} days`,
        archived: archivedCount,
        archiveDays,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ARCHIVE CRON] Error:", error);
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMsg,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
