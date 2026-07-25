export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { supabase } from "../../lib/supabase";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request }: { request: Request }) {
  // Must be an authenticated admin
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return json({ error: "unauthenticated" }, 401);

  if (!supabaseAdmin) return json({ error: "service_role_not_configured" }, 500);

  // Check admin status
  const { data: isAdmin } = await supabaseAdmin.rpc("is_admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { reviewId, status } = body as Record<string, unknown>;
  if (!reviewId || typeof reviewId !== "string") return json({ error: "invalid_input", message: "reviewId is required." }, 400);
  if (status !== "approved" && status !== "rejected") return json({ error: "invalid_input", message: "status must be approved or rejected." }, 400);

  const { error } = await supabaseAdmin
    .from("contractor_reviews")
    .update({ status })
    .eq("id", reviewId);

  if (error) return json({ error: "update_failed", message: error.message }, 500);

  return json({ ok: true }, 200);
}
