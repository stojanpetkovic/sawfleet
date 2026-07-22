import type { APIRoute } from "astro";
import { syncPermitLeads } from "../../lib/permitData";

export const GET: APIRoute = () => new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
  status: 405,
  headers: { "Content-Type": "application/json" },
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const result = await syncPermitLeads(1000, { sendOutreach: true, siteUrl: new URL(request.url).origin });
    return new Response(JSON.stringify({ ok: true, created: result.created?.length || 0, audit: result.audit || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Permit run failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
