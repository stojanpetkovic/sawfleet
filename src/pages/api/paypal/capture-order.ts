export const prerender = false;

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { authenticateUser } from "../../../lib/userAuth";
import { capturePayPalOrder } from "../../../lib/paypal";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const TABLES = {
  contractor: { table: "contractors", idCol: "user_id" },
  truck_owner: { table: "truck_owners", idCol: "id" },
} as const;

export async function POST({ request }: { request: Request }) {
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const { authenticated, user } = await authenticateUser(request);
  if (!authenticated || !user) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  const orderId = typeof body?.orderId === "string" ? body.orderId : null;
  if (!orderId) return json({ ok: false, error: "invalid_input" }, 400);

  const { data: purchase } = await supabaseAdmin.from("credit_purchases").select("*").eq("paypal_order_id", orderId).maybeSingle();
  if (!purchase) return json({ ok: false, error: "not_found" }, 404);
  if (purchase.account_id !== user.id) return json({ ok: false, error: "forbidden" }, 403);

  if (purchase.status === "completed") {
    return json({ ok: true, alreadyCompleted: true });
  }

  let capture;
  try {
    capture = await capturePayPalOrder(orderId);
  } catch (err) {
    await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    return json({ ok: false, error: "paypal_error", message: "PayPal could not complete this payment." }, 502);
  }

  const amountMatches = capture.capturedAmount !== null && Math.abs(capture.capturedAmount - Number(purchase.amount)) < 0.01;
  if (capture.status !== "COMPLETED" || !amountMatches) {
    await supabaseAdmin.from("credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    return json({ ok: false, error: "capture_failed", message: "Payment was not completed." }, 400);
  }

  const { table, idCol } = TABLES[purchase.account_type as keyof typeof TABLES];
  const { data: account } = await supabaseAdmin.from(table).select(`${idCol}, credit_balance`).eq(idCol, purchase.account_id).maybeSingle();
  const newBalance = Number((account as any)?.credit_balance || 0) + Number(purchase.amount);

  const { error: updateError } = await supabaseAdmin.from(table).update({ credit_balance: newBalance }).eq(idCol, purchase.account_id);
  if (updateError) return json({ ok: false, error: "db_error", message: updateError.message }, 500);

  await supabaseAdmin.from("credit_transactions").insert([{
    account_type: purchase.account_type,
    account_id: purchase.account_id,
    amount: purchase.amount,
    balance_after: newBalance,
    reason: "paypal_purchase",
    created_by: "paypal",
    metadata: { paypal_order_id: orderId },
  }]);

  await supabaseAdmin.from("credit_purchases").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", purchase.id);

  return json({ ok: true, balance: newBalance });
}
