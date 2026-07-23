export const prerender = false;

import { getPermitAutomationSettings, savePermitAutomationSettings } from "../../lib/permitData";

export async function GET() {
  try {
    const settings = await getPermitAutomationSettings();
    return new Response(JSON.stringify({ ok: true, settings }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    await savePermitAutomationSettings({
      enabled: !!body.enabled,
      autoSend: !!body.autoSend,
      minScore: Number(body.minScore ?? 0),
      autoApprove: !!body.autoApprove,
      frontendAutoPublish: body.frontendAutoPublish !== false,
      externalAutoPublish: !!body.externalAutoPublish,
      externalAutoPublishDomains: Array.isArray(body.externalAutoPublishDomains) ? body.externalAutoPublishDomains.filter(Boolean).map(String) : [],
      externalMinQualityScore: Math.max(0, Math.min(100, Number(body.externalMinQualityScore ?? 70))),
      notifyContractorsOnPublish: body.notifyContractorsOnPublish !== false,
      notifyTruckOwnersOnPublish: body.notifyTruckOwnersOnPublish !== false,
      permitManualPublishRequiresConfirmation: body.permitManualPublishRequiresConfirmation !== false,
      permitMaxEmailAttempts: Math.max(1, Math.min(10, Number(body.permitMaxEmailAttempts ?? 3))),
      emailSubject: String(body.emailSubject || "We can help with your permit project"),
      emailTemplate: String(body.emailTemplate || ""),
      allowedTerritories: Array.isArray(body.allowedTerritories) ? body.allowedTerritories.filter(Boolean).map(String) : [],
      archiveDays: Number(body.archiveDays ?? 60),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
