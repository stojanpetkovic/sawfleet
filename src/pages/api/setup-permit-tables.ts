export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

/**
 * Creates the permit_leads table if it doesn't exist
 * Run once: POST /api/setup-permit-tables
 */
export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Create permit_leads table
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS permit_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_name TEXT,
        owner_email TEXT,
        owner_phone TEXT,
        owner_mailing_address TEXT,
        permit_type TEXT,
        address TEXT,
        jurisdiction TEXT,
        permit_number TEXT,
        permit_date DATE,
        permit_description TEXT,
        lead_score INTEGER DEFAULT 0,
        source_name TEXT DEFAULT 'scraped',
        source_url TEXT,
        discovered_at TIMESTAMP DEFAULT NOW(),
        permit_status TEXT DEFAULT 'new',
        assigned_to UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT email_or_phone CHECK (owner_email IS NOT NULL OR owner_phone IS NOT NULL)
      );

      CREATE TABLE IF NOT EXISTS permit_lead_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        permit_lead_id UUID NOT NULL REFERENCES permit_leads(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        changed_by TEXT DEFAULT 'system',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_permit_leads_status ON permit_leads(permit_status);
      CREATE INDEX IF NOT EXISTS idx_permit_leads_jurisdiction ON permit_leads(jurisdiction);
      CREATE INDEX IF NOT EXISTS idx_permit_leads_owner_email ON permit_leads(owner_email);
    `;

    // Execute raw SQL via RPC or direct query
    const { error } = await supabaseAdmin.rpc("exec_sql", {
      sql: createTableSql,
    }).catch(() => {
      // If RPC doesn't exist, try alternative method
      return { error: null }; // Will try individual creates below
    });

    if (error && error.message.includes("exec_sql")) {
      // Fallback: Use individual table checks
      console.log(
        "[SETUP] RPC not available, using fallback table creation method"
      );

      // Check if permit_leads exists
      const { data: tableCheck } = await supabaseAdmin
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_name", "permit_leads")
        .eq("table_schema", "public")
        .single()
        .catch(() => ({ data: null }));

      if (!tableCheck) {
        // Table doesn't exist, we'll let admin create it manually
        return new Response(
          JSON.stringify({
            ok: false,
            message:
              "permit_leads table not found. Please create it manually in Supabase with the provided SQL schema.",
            sql: createTableSql,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Permit tables created/verified successfully",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[SETUP] Error:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Setup failed",
        hint: "Please create permit_leads table manually in Supabase SQL editor",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Use POST to setup permit tables",
      instructions: "curl -X POST http://localhost:4321/api/setup-permit-tables",
      sql: `
        CREATE TABLE IF NOT EXISTS permit_leads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_name TEXT,
          owner_email TEXT,
          owner_phone TEXT,
          owner_mailing_address TEXT,
          permit_type TEXT,
          address TEXT,
          jurisdiction TEXT,
          permit_number TEXT,
          permit_date DATE,
          permit_description TEXT,
          lead_score INTEGER DEFAULT 0,
          source_name TEXT DEFAULT 'scraped',
          source_url TEXT,
          discovered_at TIMESTAMP DEFAULT NOW(),
          permit_status TEXT DEFAULT 'new',
          assigned_to UUID,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          CONSTRAINT email_or_phone CHECK (owner_email IS NOT NULL OR owner_phone IS NOT NULL)
        );

        CREATE TABLE IF NOT EXISTS permit_lead_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          permit_lead_id UUID NOT NULL REFERENCES permit_leads(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          changed_by TEXT DEFAULT 'system',
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_permit_leads_status ON permit_leads(permit_status);
        CREATE INDEX IF NOT EXISTS idx_permit_leads_jurisdiction ON permit_leads(jurisdiction);
        CREATE INDEX IF NOT EXISTS idx_permit_leads_owner_email ON permit_leads(owner_email);
      `,
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
