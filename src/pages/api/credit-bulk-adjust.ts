export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const TABLES = {
  contractor: { table: "contractors", idCol: "user_id", activeStatus: "active" },
  truck_owner: { table: "truck_owners", idCol: "id", activeStatus: "approved" },
} as const;

type AccountType = keyof typeof TABLES;

export async function POST({ request }: { request: Request }) {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const body = await request.json().catch(() => null);
  const target = body?.target as "all_contractors" | "all_truck_owners" | "selected";
  const amount = Math.round(Number(body?.amount));
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;

  if (!Number.isFinite(amount) || amount === 0) {
    return json({ ok: false, error: "a non-zero amount is required" }, 400);
  }

  let targets: { accountType: AccountType; accountId: string }[] = [];

  if (target === "all_contractors" || target === "all_truck_owners") {
    const accountType: AccountType = target === "all_contractors" ? "contractor" : "truck_owner";
    const { table, idCol, activeStatus } = TABLES[accountType];
    const { data } = await supabaseAdmin.from(table).select(idCol).eq("status", activeStatus).not(idCol, "is", null);
    targets = (data || []).map((row: any) => ({ accountType, accountId: row[idCol] }));
  } else if (target === "selected") {
    const accounts = Array.isArray(body?.accounts) ? body.accounts : [];
    targets = accounts.filter((a: any) => a?.accountId && TABLES[a?.accountType as AccountType]);
  } else {
    return json({ ok: false, error: "target must be all_contractors, all_truck_owners or selected" }, 400);
  }

  if (targets.length === 0) return json({ ok: false, error: "no_accounts_matched" }, 400);

  let updated = 0;
  const failed: string[] = [];

  for (const t of targets) {
    const { table, idCol } = TABLES[t.accountType];
    const { data: account, error: fetchError } = await supabaseAdmin
      .from(table)
      .select(`${idCol}, credit_balance`)
      .eq(idCol, t.accountId)
      .maybeSingle();
    if (fetchError || !account) {
      failed.push(t.accountId);
      continue;
    }

    const newBalance = Number((account as any).credit_balance || 0) + amount;
    const { error: updateError } = await supabaseAdmin.from(table).update({ credit_balance: newBalance }).eq(idCol, t.accountId);
    if (updateError) {
      failed.push(t.accountId);
      continue;
    }

    await supabaseAdmin.from("credit_transactions").insert([{
      account_type: t.accountType,
      account_id: t.accountId,
      amount,
      balance_after: newBalance,
      reason: amount > 0 ? "admin_topup" : "admin_adjust",
      created_by: authorization.actor || "admin",
      metadata: note ? { note, bulk: true } : { bulk: true },
    }]);
    updated++;
  }

  return json({ ok: true, updated, total: targets.length, failed: failed.length });
}
