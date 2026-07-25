export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Called after magic link login when no customer record exists yet.
// Creates the customer row and links any historical leads by email.
export async function POST({ request }: { request: Request }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return json({ error: "unauthenticated" }, 401);
  if (!supabaseAdmin) return json({ error: "service_role_not_configured" }, 500);

  const email = session.user.email?.toLowerCase().trim();
  if (!email) return json({ error: "no_email" }, 400);

  // Upsert customer (by email — handles both new and returning customers)
  const { data: customer, error: upsertErr } = await supabaseAdmin
    .from("customers")
    .upsert(
      { email, user_id: session.user.id, last_seen_at: new Date().toISOString() },
      { onConflict: "email", ignoreDuplicates: false }
    )
    .select("id")
    .maybeSingle();

  if (upsertErr) return json({ error: upsertErr.message }, 500);

  // If customer existed (no id returned on duplicate), fetch it
  let customerId = customer?.id;
  if (!customerId) {
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id, user_id")
      .eq("email", email)
      .maybeSingle();
    customerId = existing?.id;
    // Link user_id if not already set
    if (existing && !existing.user_id) {
      await supabaseAdmin
        .from("customers")
        .update({ user_id: session.user.id, last_seen_at: new Date().toISOString() })
        .eq("id", customerId);
    }
  }

  if (!customerId) return json({ error: "customer_not_found" }, 500);

  // Link any historical leads that have this email but no customer_id
  await supabaseAdmin
    .from("leads")
    .update({ customer_id: customerId })
    .eq("email", email)
    .is("customer_id", null);

  return json({ ok: true, customerId });
}
