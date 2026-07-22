export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

/**
 * Execute raw SQL to add archive columns to permit_leads table
 * This is a one-time setup endpoint
 */
export async function POST() {
  try {
    console.log("[ADD COLUMNS] Starting to add archive columns to permit_leads");

    // Try adding columns one by one
    const statements = [
      "ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;",
      "ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;"
    ];

    let success = true;
    const results = [];

    for (const sql of statements) {
      try {
        // Use the admin client to execute raw SQL
        const { error } = await supabaseAdmin.rpc("execute_sql", { 
          sql_string: sql 
        }).catch(() => {
          // If RPC doesn't exist, try a different approach
          return { error: { message: "RPC not available, trying direct approach" } };
        });

        if (!error || error.message.includes("column") === false) {
          results.push({ sql, status: "executed or already exists" });
        } else {
          results.push({ sql, error: error.message });
        }
      } catch (e) {
        results.push({ sql, error: String(e) });
      }
    }

    // Verify columns exist by trying to query them
    try {
      const { error: verifyError } = await supabaseAdmin
        .from("permit_leads")
        .select("archived_at, archive_reason")
        .limit(1);

      if (!verifyError) {
        console.log("[ADD COLUMNS] ✓ Columns verified successfully");
        return new Response(
          JSON.stringify({
            ok: true,
            message: "Archive columns are ready",
            results,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (e) {
      console.log("[ADD COLUMNS] Could not verify columns:", e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Attempted to add columns. Please verify in Supabase dashboard.",
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ADD COLUMNS] Error:", error);
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMsg,
        note: "If RPC not found, run SQL manually in Supabase: ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP; ALTER TABLE permit_leads ADD COLUMN IF NOT EXISTS archive_reason TEXT;",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
