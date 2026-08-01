export const prerender = false;

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { authenticateUser } from "../../../lib/userAuth";
import { createPayPalOrder } from "../../../lib/paypal";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const MIN_AMOUNT = 5;

export async function POST({ request }: { request: Request }) {
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const { authenticated, user } = await authenticateUser(request);
  if (!authenticated || !user) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await request.json().catch(() => null);
  const amount = Math.round(Number(body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return json({ ok: false, error: "invalid_amount", message: `Minimum purchase is $${MIN_AMOUNT}.` }, 400);
  }

  const { data: contractor } = await supabaseAdmin.from("contractors").select("user_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
  const { data: truckOwner } = contractor ? { data: null } : await supabaseAdmin.from("truck_owners").select("id").eq("id", user.id).eq("status", "approved").maybeSingle();

  const accountType = contractor ? "contractor" : truckOwner ? "truck_owner" : null;
  const accountId = contractor ? contractor.user_id : truckOwner ? truckOwner.id : null;
  if (!accountType || !accountId) {
    return json({ ok: false, error: "not_eligible", message: "No active contractor or approved truck owner account found for this login." }, 403);
  }

  let order;
  try {
    order = await createPayPalOrder(amount);
  } catch (err: any) {
    const message = err?.message === "paypal_not_configured" ? "PayPal purchases aren't enabled yet." : "Could not start the PayPal order.";
    return json({ ok: false, error: "paypal_error", message }, 502);
  }

  const { error: insertError } = await supabaseAdmin.from("credit_purchases").insert([{
    account_type: accountType,
    account_id: accountId,
    amount,
    paypal_order_id: order.id,
    status: "created",
  }]);
  if (insertError) return json({ ok: false, error: "db_error", message: insertError.message }, 500);

  return json({ ok: true, orderId: order.id });
}
