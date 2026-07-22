import type { APIRoute } from "astro";
import { getPermitAutomationSettings } from "../../lib/permitData";

export const GET: APIRoute = async () => {
  try {
    const settings = await getPermitAutomationSettings();
    return new Response(JSON.stringify({ ok: true, audit: settings.audit || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Audit lookup failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
