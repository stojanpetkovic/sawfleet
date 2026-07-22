export const prerender = false;

import { syncPermitLeads } from "../../lib/permitData";

export async function GET() {
  try {
    const result = await syncPermitLeads(100, {
      sendOutreach: true,
      siteUrl: import.meta.env.PUBLIC_SITE_URL || "https://sawfleet2026-eng.github.io/Tree-Permit-Lead-Dashboard/",
    });

    return new Response(JSON.stringify({ ok: true, created: result.created.length, leads: result.leads.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
