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

    const { ownerId, email, companyName, contactName, phone } = await request.json();
    if (!ownerId || !email) {
      return json({ error: "invalid_input", message: "ownerId and email are required." }, 400);
    }

    // Napomena: namerno NE proveravamo ownerId preko auth.admin.getUserById.
    // Kad je "Confirm email" uključen i neko drugi put pošalje signUp za
    // već postojeći, još nepotvrđen email, Supabase (namerno, da ne otkriva
    // da nalog postoji) vraća user objekat koji se ne poklapa 1:1 sa
    // internim auth.users redom preko admin API-ja — ta provera bi tada
    // lažno odbila potpuno legitimnu registraciju. Ovaj endpoint upisuje
    // samo neosetljive profilne podatke (naziv firme/kontakt/telefon),
    // ne dodeljuje nikakva prava — pravi RLS i dalje važi za sve dalje
    // izmene (owner menja svoj red isključivo preko svoje sesije).
    // Ako profil već postoji (npr. formu poslao dvaput, ili je ovaj
    // owner već ranije uspešno napravljen), ne prepisujemo ga — pogotovo
    // ne bismo hteli da mu nazad vratimo status na 'pending' ako je u
    // međuvremenu već odobren.
    const { data: existing } = await supabaseAdmin.from("truck_owners").select("id").eq("id", ownerId).maybeSingle();
    if (existing) {
      return json({ ok: true, alreadyExisted: true }, 200);
    }

    const { error: insertError } = await supabaseAdmin.from("truck_owners").insert([{
      id: ownerId,
      company_name: companyName || null,
      contact_name: contactName || null,
      email: String(email).trim().toLowerCase(),
      phone: phone || null,
      status: "pending",
    }]);

    if (insertError) {
      const isFkViolation = insertError.code === '23503' || /foreign key/i.test(insertError.message || '');
      if (isFkViolation) {
        return json({
          error: "unconfirmed_or_missing_account",
          message: "This account isn't fully set up yet (likely an unconfirmed email from a previous attempt). Please confirm the email, or log in and re-save your profile from the dashboard.",
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
