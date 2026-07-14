export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request }: { request: Request }) {
  try {
    // 1) Ko poziva ovo? Klijent šalje svoj access_token, mi ga
    //    proveravamo — bez ovoga bi svako ko sazna URL rute mogao
    //    da menja lozinke tuđih naloga.
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "missing_token" }, 401);

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);

    // 2) Da li je taj korisnik stvarno admin?
    const { data: adminRow } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!adminRow) return json({ error: "not_admin" }, 403);

    // 3) Is the service_role key even configured?
    if (!supabaseAdmin) {
      return json({ error: "service_role_not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set in .env" }, 500);
    }

    const { contractorUserId, newPassword } = await request.json();
    if (!contractorUserId || !newPassword || newPassword.length < 6) {
      return json({ error: "invalid_input", message: "Password must be at least 6 characters." }, 400);
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(contractorUserId, { password: newPassword });
    if (error) return json({ error: "update_failed", message: error.message }, 500);

    return json({ ok: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "unexpected_error", message: String(err) }, 500);
  }
}
