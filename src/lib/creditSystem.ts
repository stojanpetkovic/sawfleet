import { supabaseAdmin } from "./supabaseAdmin";

export type CreditSettings = {
  id: number;
  enabled: boolean;
  contractor_lead_cost: number;
  truck_lead_cost: number;
  auto_refill_enabled: boolean;
  auto_refill_amount: number;
  auto_refill_interval_days: number;
  updated_at: string;
};

export async function getCreditSettings(): Promise<CreditSettings | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.from("credit_settings").select("*").eq("id", 1).maybeSingle();
  return data as CreditSettings | null;
}

// Prolazi kroz aktivne kontraktore/vlasnike kamiona i dopunjuje kredit onima
// kojima je istekao auto_refill_interval_days od poslednje dopune (ili je
// nikad nisu dobili). Poziva se iz permit-sync.ts, koji se već izvršava na
// 6h preko postojećeg pg_cron-a — nema potrebe za posebnim cron poslom.
export async function processCreditAutoRefill() {
  if (!supabaseAdmin) return { ok: false, refilled: 0 };
  const settings = await getCreditSettings();
  if (!settings || !settings.enabled || !settings.auto_refill_enabled || settings.auto_refill_amount <= 0) {
    return { ok: true, refilled: 0, skipped: "disabled" };
  }

  const cutoff = new Date(Date.now() - settings.auto_refill_interval_days * 86400000).toISOString();
  let refilled = 0;

  for (const [accountType, table, idCol] of [
    ["contractor", "contractors", "user_id"],
    ["truck_owner", "truck_owners", "id"],
  ] as const) {
    const activeStatus = accountType === "contractor" ? "active" : "approved";
    const { data: due } = await supabaseAdmin
      .from(table)
      .select(`${idCol}, credit_balance, last_auto_refill_at`)
      .eq("status", activeStatus)
      .or(`last_auto_refill_at.is.null,last_auto_refill_at.lt.${cutoff}`);

    for (const row of due || []) {
      const accountId = (row as any)[idCol];
      const newBalance = Number((row as any).credit_balance || 0) + settings.auto_refill_amount;
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from(table)
        .update({ credit_balance: newBalance, last_auto_refill_at: now })
        .eq(idCol, accountId);
      if (error) continue;
      await supabaseAdmin.from("credit_transactions").insert([{
        account_type: accountType,
        account_id: accountId,
        amount: settings.auto_refill_amount,
        balance_after: newBalance,
        reason: "auto_refill",
        created_by: "system",
      }]);
      refilled++;
    }
  }

  return { ok: true, refilled };
}
