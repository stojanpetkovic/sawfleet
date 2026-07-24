export const prerender = false;

import { getPermitAutomationSettings, savePermitAutomationSettings } from "../../lib/permitData";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export async function GET({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const settings = await getPermitAutomationSettings();
    return new Response(JSON.stringify({ ok: true, settings }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const body = await request.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const current = await getPermitAutomationSettings();
    await savePermitAutomationSettings({
      ...current,
      enabled: body.enabled === undefined ? current.enabled : !!body.enabled,
      autoSend: body.autoSend === undefined ? current.autoSend : !!body.autoSend,
      minScore: Number(body.minScore ?? current.minScore),
      autoApprove: body.autoApprove === undefined ? current.autoApprove : !!body.autoApprove,
      frontendAutoPublish: body.frontendAutoPublish === undefined ? current.frontendAutoPublish : body.frontendAutoPublish !== false,
      externalAutoPublish: body.externalAutoPublish === undefined ? current.externalAutoPublish : !!body.externalAutoPublish,
      externalAutoPublishDomains: Array.isArray(body.externalAutoPublishDomains) ? body.externalAutoPublishDomains.filter(Boolean).map(String) : current.externalAutoPublishDomains,
      externalMinQualityScore: Math.max(0, Math.min(100, Number(body.externalMinQualityScore ?? current.externalMinQualityScore))),
      notifyContractorsOnPublish: body.notifyContractorsOnPublish === undefined ? current.notifyContractorsOnPublish : body.notifyContractorsOnPublish !== false,
      notifyTruckOwnersOnPublish: body.notifyTruckOwnersOnPublish === undefined ? current.notifyTruckOwnersOnPublish : body.notifyTruckOwnersOnPublish !== false,
      permitManualPublishRequiresConfirmation: body.permitManualPublishRequiresConfirmation === undefined ? current.permitManualPublishRequiresConfirmation : body.permitManualPublishRequiresConfirmation !== false,
      permitMaxEmailAttempts: Math.max(1, Math.min(10, Number(body.permitMaxEmailAttempts ?? current.permitMaxEmailAttempts))),
      permitDailyEmailLimit: Math.max(1, Math.min(100, Number(body.permitDailyEmailLimit ?? current.permitDailyEmailLimit))),
      permitEmailCooldownDays: Math.max(3, Math.min(365, Number(body.permitEmailCooldownDays ?? current.permitEmailCooldownDays))),
      emailSubject: body.emailSubject === undefined ? current.emailSubject : String(body.emailSubject || current.emailSubject),
      emailTemplate: body.emailTemplate === undefined ? current.emailTemplate : String(body.emailTemplate || current.emailTemplate),
      allowedTerritories: Array.isArray(body.allowedTerritories) ? body.allowedTerritories.filter(Boolean).map(String) : current.allowedTerritories,
      archiveDays: Number(body.archiveDays ?? current.archiveDays),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
