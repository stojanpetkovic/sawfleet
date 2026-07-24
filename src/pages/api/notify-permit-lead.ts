export const prerender = false;

import { buildPermitOutreachEmail, getPermitAutomationSettings } from "../../lib/permitData";
import { sendEmail } from "../../lib/resend";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.email) return new Response(JSON.stringify({ ok: false, error: "email_required" }), { status: 400 });
    const settings = await getPermitAutomationSettings();
    const siteUrl = body.siteUrl || import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const message = buildPermitOutreachEmail({
      fullName: body.fullName || "there",
      permitDetails: body.permitDetails || body.message || "Permit opportunity",
      siteUrl,
      settings,
    });
    const result = await sendEmail({ to: body.email, subject: message.subject, html: message.html });
    return new Response(JSON.stringify(result.ok
      ? { ok: true, sent: true }
      : { ok: false, error: result.error }), {
      status: result.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-permit-lead failed", error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 });
  }
}
