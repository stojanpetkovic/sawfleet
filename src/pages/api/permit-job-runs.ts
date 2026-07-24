export const prerender = false;

import type { APIRoute } from "astro";
import { getPermitJobRuns, getPermitSourceLeadCounts } from "../../lib/permitData";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export const GET: APIRoute = async ({ request }) => {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [runs, leadCounts] = await Promise.all([
      getPermitJobRuns(500),
      getPermitSourceLeadCounts(),
    ]);

    return new Response(JSON.stringify({ ok: true, runs, leadCounts }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Job run lookup failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
