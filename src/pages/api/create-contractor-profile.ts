export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!supabaseAdmin) {
      return json({ error: "service_role_not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set in .env" }, 500);
    }

    const { userId, email, companyName, contactName, phone, territory, source } = await request.json();
    if (!userId || !email) {
      return json({ error: "invalid_input", message: "userId and email are required." }, 400);
    }

    // Isti razlog kao kod create-owner-profile.ts: ne oslanjamo se na
    // auth.uid() postojanje u trenutku signUp-a (ako je "Confirm email"
    // uključeno, nema sesije, pa bi insert sa browser klijenta pukao na
    // RLS). Service role zaobilazi to. Ne prepisujemo postojeći red da
    // ne bismo nekom već odobrenom kontraktoru vratili status na 'pending'.
    const { data: existing } = await supabaseAdmin.from("contractors").select("id").eq("user_id", userId).maybeSingle();
    if (existing) {
      return json({ ok: true, alreadyExisted: true }, 200);
    }

    const { error: insertError } = await supabaseAdmin.from("contractors").insert([{
      user_id: userId,
      company_name: companyName || null,
      contact_name: contactName || null,
      email: String(email).trim().toLowerCase(),
      phone: phone || null,
      territory: territory || null,
      status: "pending",
      source: source || null,
    }]);

    if (insertError) {
      const isFkViolation = insertError.code === '23503' || /foreign key/i.test(insertError.message || '');
      if (isFkViolation) {
        return json({
          error: "unconfirmed_or_missing_account",
          message: "This account isn't fully set up yet (likely an unconfirmed email from a previous attempt). Please confirm the email, or log in and try again.",
        }, 409);
      }
      return json({ error: "insert_failed", message: insertError.message }, 500);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "unexpected_error", message: String(err) }, 500);
  }
}
