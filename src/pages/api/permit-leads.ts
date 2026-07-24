export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export async function GET({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch all permit leads from permit_leads table (including archived)
    const { data: leads, error } = await supabaseAdmin
      .from('permit_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    // Normalize field names
    const normalizedLeads = (leads || [])
      .map((lead: any) => ({
        ...lead,
        owner_email: lead.owner_email || lead.email || null,
        owner_phone: lead.owner_phone || lead.phone || null,
        archived_at: lead.archived_at || null,
      }));

    return new Response(JSON.stringify({ ok: true, leads: normalizedLeads, created: 0 }), {
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
