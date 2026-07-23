import type { APIRoute } from "astro";

const retired = () => new Response(JSON.stringify({
  ok: false,
  error: "legacy_endpoint_retired",
  message: "Use POST /api/permit-sync. Permits are opportunities and are never inserted directly into Website Leads.",
}), { status: 410, headers: { "Content-Type": "application/json" } });

export const GET: APIRoute = retired;
export const POST: APIRoute = retired;
