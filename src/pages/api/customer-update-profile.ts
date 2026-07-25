export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request }: { request: Request }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return json({ error: "unauthenticated" }, 401);
  if (!supabaseAdmin) return json({ error: "service_role_not_configured" }, 500);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const { full_name, phone } = body;

  // Sanitise
  const safeName = typeof full_name === "string" ? full_name.trim().slice(0, 100) || null : null;
  const safePhone = typeof phone === "string" ? phone.trim().slice(0, 30) || null : null;

  const { error } = await supabaseAdmin
    .from("customers")
    .update({ full_name: safeName, phone: safePhone })
    .eq("user_id", session.user.id);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
