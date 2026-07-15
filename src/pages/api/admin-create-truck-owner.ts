export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request }: { request: Request }) {
  try {
    // 1) Proveri da poziv stvarno dolazi od ulogovanog admina — isti
    //    obrazac kao admin-reset-password.ts.
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "missing_token" }, 401);

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);

    const { data: adminRow } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!adminRow) return json({ error: "not_admin" }, 403);

    if (!supabaseAdmin) {
      return json({ error: "service_role_not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set in .env" }, 500);
    }

    const { email, password, companyName, contactName, phone } = await request.json();
    if (!email || !password || password.length < 6) {
      return json({ error: "invalid_input", message: "Valid email and a password of at least 6 characters are required." }, 400);
    }

    // 2) Napravi auth nalog za vlasnika (service role — admin API)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      return json({ error: "create_user_failed", message: createError?.message || "Could not create the account." }, 400);
    }

    // 3) Napravi profil vlasnika
    const { error: profileError } = await supabaseAdmin.from("truck_owners").insert([{
      id: created.user.id,
      company_name: companyName || null,
      contact_name: contactName || null,
      email: String(email).trim().toLowerCase(),
      phone: phone || null,
    }]);

    if (profileError) {
      return json({ error: "profile_failed", message: profileError.message, userId: created.user.id }, 500);
    }

    return json({ ok: true, ownerId: created.user.id, email: created.user.email }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "unexpected_error", message: String(err) }, 500);
  }
}
