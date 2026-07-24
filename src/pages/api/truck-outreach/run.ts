export const prerender = false;
import { runTruckOutreachBatch } from "../../../lib/truckOutreach";
import { authorizeAutomationRequest } from "../../../lib/automationAuth";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);

    const result = await runTruckOutreachBatch();
    return json(result, result.ok ? 200 : 500);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Truck outreach batch crashed:", error);
    return json({
      ok: false,
      error: "batch_execution_failed",
      detail: message || "Unexpected server error",
    }, 500);
  }
}
