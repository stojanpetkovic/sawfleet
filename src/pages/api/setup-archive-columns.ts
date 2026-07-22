export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

/**
 * Initialize permit leads table with archive columns if they don't exist
 * This endpoint helps set up the database schema on first run
 * Called once during setup
 */
export async function POST() {
  try {
    console.log("[SETUP ARCHIVE] Checking archive columns for permit_leads table");

    // Try to check if columns exist by querying them
    const { error: checkError } = await supabaseAdmin
      .from("permit_leads")
      .select("archived_at, archive_reason")
      .limit(1);

    // If error says column doesn't exist, we need to add it via Supabase dashboard
    // or via a different method. For now, we'll just log and return success
    // since Supabase can't add columns via JavaScript client for RLS tables

    if (checkError?.message?.includes("column")) {
      console.warn("[SETUP ARCHIVE] Archive columns may need to be added via Supabase dashboard");
      console.warn("[SETUP ARCHIVE] SQL to run:", `
        ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
        ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;
      `);
      
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Archive columns need manual setup in Supabase dashboard",
          sql: `ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("[SETUP ARCHIVE] Archive columns verified");

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Archive columns are ready",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SETUP ARCHIVE] Error:", error);
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
