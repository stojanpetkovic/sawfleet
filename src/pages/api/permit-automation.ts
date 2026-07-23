export const prerender = false;

export async function GET() {
  return new Response(JSON.stringify({
    ok: false,
    error: "legacy_endpoint_retired",
    message: "Use POST /api/permit-sync. Permit automation now writes only to Permit Opportunities.",
  }), { status: 410, headers: { "Content-Type": "application/json" } });
}
