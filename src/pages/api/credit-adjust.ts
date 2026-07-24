export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const TABLES = {
  contractor: { table: "contractors", idCol: "user_id" },
  truck_owner: { table: "truck_owners", idCol: "id" },
} as const;

export async function POST({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const body = await request.json().catch(() => null);
  const accountType = body?.accountType as keyof typeof TABLES;
  const accountId = body?.accountId as string;
  const amount = Math.round(Number(body?.amount));
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;

  if (!accountId || !TABLES[accountType] || !Number.isFinite(amount) || amount === 0) {
    return json({ ok: false, error: "accountType, accountId and a non-zero amount are required" }, 400);
  }

  const { table, idCol } = TABLES[accountType];
  const { data: account, error: fetchError } = await supabaseAdmin.from(table).select(`${idCol}, credit_balance`).eq(idCol, accountId).maybeSingle();
  if (fetchError || !account) return json({ ok: false, error: "account_not_found" }, 404);

  const newBalance = Number((account as any).credit_balance || 0) + amount;
  const { error: updateError } = await supabaseAdmin.from(table).update({ credit_balance: newBalance }).eq(idCol, accountId);
  if (updateError) return json({ ok: false, error: updateError.message }, 500);

  await supabaseAdmin.from("credit_transactions").insert([{
    account_type: accountType,
    account_id: accountId,
    amount,
    balance_after: newBalance,
    reason: amount > 0 ? "admin_topup" : "admin_adjust",
    created_by: authorization.actor || "admin",
    metadata: note ? { note } : null,
  }]);

  return json({ ok: true, balance: newBalance });
}
