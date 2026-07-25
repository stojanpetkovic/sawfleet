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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return json({ error: "unauthenticated" }, 401);
  if (!supabaseAdmin) return json({ error: "service_role_not_configured" }, 500);

  const { data: isAdmin } = await supabaseAdmin.rpc("is_admin");
  if (!isAdmin) return json({ error: "forbidden" }, 403);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const { contractorId, isPublic } = body as Record<string, unknown>;
  if (!contractorId || typeof contractorId !== "string") return json({ error: "invalid_input" }, 400);

  const { error } = await supabaseAdmin
    .from("contractors")
    .update({ is_public: Boolean(isPublic) })
    .eq("id", contractorId);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true }, 200);
}
