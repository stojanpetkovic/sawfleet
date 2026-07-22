import type { APIRoute } from "astro";
import { buildPermitOutreachEmail, getPermitAutomationSettings } from "../../lib/permitData";

export const GET: APIRoute = () => new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
  status: 405,
  headers: { "Content-Type": "application/json" },
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const settings = await getPermitAutomationSettings();
    const { fullName, permitDetails, siteUrl } = body as { fullName?: string; permitDetails?: string; siteUrl?: string };
    const { subject, html } = buildPermitOutreachEmail({
      fullName: fullName || "there",
      permitDetails: permitDetails || "Sample permit details",
      siteUrl: siteUrl || "https://example.com",
      settings,
    });

    return new Response(JSON.stringify({ ok: true, subject, html }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Preview failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
