export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { getPermitAutomationSettings } from "../../lib/permitData";

async function runArchiveCron() {
  const settings = await getPermitAutomationSettings();

  if (!settings.enabled) {
    return new Response(
      JSON.stringify({ ok: true, message: "Automation disabled", archived: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const archiveDays = settings.archiveDays || 60;
  const archiveDate = new Date();
  archiveDate.setDate(archiveDate.getDate() - archiveDays);
  const archiveDateStr = archiveDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Archive based on permit_date (date filed), falling back to created_at if permit_date is null
  const { data: archivedLeads, error: archiveError } = await supabaseAdmin
    .from("permit_leads")
    .update({
      archived_at: new Date().toISOString(),
      archive_reason: `Auto-archived: permit date older than ${archiveDays} days`,
    })
    .eq("permit_status", "new")
    .is("archived_at", null)
    .or(`permit_date.lt.${archiveDateStr},and(permit_date.is.null,created_at.lt.${archiveDate.toISOString()})`)
    .select();

  if (archiveError) throw archiveError;

  const archivedCount = archivedLeads?.length || 0;
  return new Response(
    JSON.stringify({
      ok: true,
      message: `Archived ${archivedCount} permits with permit date older than ${archiveDays} days`,
      archived: archivedCount,
      archiveDays,
      archiveBefore: archiveDateStr,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// GET - za external cron servise (Vercel cron, cPanel, curl cron)
export async function GET() {
  try {
    return await runArchiveCron();
  } catch (error) {
    console.error("[ARCHIVE CRON GET]", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// POST - za manuelni trigger iz admin panela
export async function POST() {
  try {
    return await runArchiveCron();
  } catch (error) {
    console.error("[ARCHIVE CRON POST]", error);
    return new Response(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
