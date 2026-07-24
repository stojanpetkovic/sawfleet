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

    const { ownerId, email, companyName, contactName, phone, claimSlug } = await request.json();
    if (!ownerId || !email) {
      return json({ error: "invalid_input", message: "ownerId and email are required." }, 400);
    }

    // Zatvara IDOR rupu (bilo ko je mogao da prikači proizvoljan profil na
    // TUĐI ownerId): proveravamo da ownerId zaista postoji u auth.users i
    // da se njegov pravi email poklapa sa onim iz body-ja. Klijent (truck-
    // registration.astro) već prepoznaje "looksUnconfirmedRetry" (isti
    // email već postoji, nepotvrđen) i zaustavlja se PRE ovog poziva, pa se
    // ovde nikad ne pojavljuje id koji ne odgovara 1:1 auth.users redu —
    // getUserById je bezbedan da se koristi ovde.
    const { data: userLookup, error: userLookupError } = await supabaseAdmin.auth.admin.getUserById(ownerId);
    if (userLookupError || !userLookup?.user) {
      return json({ error: "invalid_user", message: "No matching account found for this id." }, 400);
    }
    if (String(userLookup.user.email || "").trim().toLowerCase() !== String(email).trim().toLowerCase()) {
      return json({ error: "email_mismatch", message: "The provided email does not match the account." }, 400);
    }

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

    let claimSubmitted = false;
    if (claimSlug) {
      const { data: claimedProfile, error: claimError } = await supabaseAdmin
        .from("unclaimed_truck_directory")
        .update({
          profile_status: "claim_pending",
          verification_status: "pending",
          claimed_owner_id: ownerId,
          updated_at: new Date().toISOString(),
        })
        .eq("slug", String(claimSlug))
        .eq("profile_status", "unclaimed")
        .select("id")
        .maybeSingle();
      if (claimError) console.error("Unable to mark directory claim:", claimError);
      claimSubmitted = Boolean(claimedProfile);
    }

    return json({ ok: true, claimSubmitted }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "unexpected_error", message: String(err) }, 500);
  }
}
