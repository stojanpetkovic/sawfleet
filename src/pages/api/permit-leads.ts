export const prerender = false;

import { syncPermitLeads } from "../../lib/permitData";

export async function GET() {
  try {
    const result = await syncPermitLeads(100, { sendOutreach: false });
    return new Response(JSON.stringify({ ok: true, leads: result.leads, created: result.created.length }), {
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
