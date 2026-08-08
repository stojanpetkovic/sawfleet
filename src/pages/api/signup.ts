export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail, verifySignupEmailHtml } from "../../lib/resend.js";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function randomToken() {
  return crypto.randomUUID() + crypto.randomUUID();
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!supabaseAdmin) {
      return json({ ok: false, error: "service_role_not_configured", message: "SUPABASE_SERVICE_ROLE_KEY is not set in .env" }, 500);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ ok: false, error: "invalid_json" }, 400);

    const role = body.role as "contractor" | "truck_owner";
    if (role !== "contractor" && role !== "truck_owner") {
      return json({ ok: false, error: "invalid_role" }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || password.length < 6) {
      return json({ ok: false, error: "invalid_input", message: "A valid email and a password of at least 6 characters are required." }, 400);
    }

    const contactName = String(body.contactName || "").trim() || null;
    const phone = String(body.phone || "").trim() || null;
    const companyName = String(body.companyName || "").trim() || null;
    const territory = role === "contractor" ? String(body.territory || "").trim() || null : null;
    const source = String(body.source || "").trim() || null;
    const claimSlug = role === "truck_owner" ? String(body.claimSlug || "").trim() || null : null;

    if (role === "contractor" && (!companyName || !contactName || !phone || !territory)) {
      return json({ ok: false, error: "invalid_input", message: "Company name, contact name, phone and territory are required." }, 400);
    }
    if (role === "truck_owner" && (!contactName || !phone)) {
      return json({ ok: false, error: "invalid_input", message: "Contact name and phone are required." }, 400);
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Supabase itself never gates login — our own pending_signups gate (below) does.
    });

    if (createError || !created?.user) {
      const alreadyExists = /already.*registered|already.*exists/i.test(createError?.message || "");
      if (alreadyExists) {
        return json({ ok: false, error: "email_already_registered", message: "This email is already registered — sign in instead." }, 409);
      }
      return json({ ok: false, error: "signup_failed", message: createError?.message || "Could not create account." }, 500);
    }

    const userId = created.user.id;

    const { data: securitySettings } = await supabaseAdmin.from("account_security_settings").select("email_verification_required").eq("id", 1).maybeSingle();
    const verificationRequired = Boolean(securitySettings?.email_verification_required);

    if (!verificationRequired) {
      const insertError = await createProfileRow(role, userId, { email, companyName, contactName, phone, territory, source, claimSlug });
      if (insertError) return json({ ok: false, error: "profile_insert_failed", message: insertError }, 500);
      notifyAdmins(role, userId, request).catch((err) => console.error("notify admins failed:", err));
      return json({ ok: true, requiresVerification: false, userId });
    }

    const token = randomToken();
    const { error: pendingError } = await supabaseAdmin.from("pending_signups").insert([{
      user_id: userId,
      role,
      payload: { email, companyName, contactName, phone, territory, source, claimSlug },
      token,
    }]);
    if (pendingError) return json({ ok: false, error: "pending_signup_failed", message: pendingError.message }, 500);

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const verifyUrl = `${siteUrl}/api/verify-signup?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: email,
      subject: "Confirm your email — SF Tree Removal",
      html: verifySignupEmailHtml({ name: contactName, verifyUrl }),
    });

    return json({ ok: true, requiresVerification: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "unexpected_error", message: String(err) }, 500);
  }
}

export async function notifyAdmins(role: "contractor" | "truck_owner", userId: string, request: Request) {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
  const endpoint = role === "contractor" ? "/api/notify-new-contractor" : "/api/notify-new-truck-owner";
  const idKey = role === "contractor" ? "userId" : "ownerId";
  await fetch(`${siteUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [idKey]: userId }),
  });
}

export async function createProfileRow(
  role: "contractor" | "truck_owner",
  userId: string,
  fields: { email: string; companyName: string | null; contactName: string | null; phone: string | null; territory: string | null; source: string | null; claimSlug: string | null }
): Promise<string | null> {
  if (!supabaseAdmin) return "service_role_not_configured";

  if (role === "contractor") {
    const { data: existing } = await supabaseAdmin.from("contractors").select("id").eq("user_id", userId).maybeSingle();
    if (existing) return null;
    const { error } = await supabaseAdmin.from("contractors").insert([{
      user_id: userId,
      company_name: fields.companyName,
      contact_name: fields.contactName,
      email: fields.email,
      phone: fields.phone,
      territory: fields.territory,
      status: "pending",
      source: fields.source,
    }]);
    return error?.message || null;
  }

  const { data: existing } = await supabaseAdmin.from("truck_owners").select("id").eq("id", userId).maybeSingle();
  if (existing) return null;
  const { error } = await supabaseAdmin.from("truck_owners").insert([{
    id: userId,
    company_name: fields.companyName,
    contact_name: fields.contactName,
    email: fields.email,
    phone: fields.phone,
    status: "pending",
  }]);
  if (error) return error.message;

  if (fields.claimSlug) {
    const { error: claimError } = await supabaseAdmin
      .from("unclaimed_truck_directory")
      .update({
        profile_status: "claim_pending",
        verification_status: "pending",
        claimed_owner_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", fields.claimSlug)
      .eq("profile_status", "unclaimed");
    if (claimError) console.error("Unable to mark directory claim:", claimError);
  }

  return null;
}
