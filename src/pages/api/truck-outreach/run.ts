export const prerender = false;
import { runTruckOutreachBatch } from "../../../lib/truckOutreach";
import { authorizeAutomationRequest } from "../../../lib/automationAuth";

export async function POST({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const result = await runTruckOutreachBatch();
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
