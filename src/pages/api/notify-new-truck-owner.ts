export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail } from "../../lib/resend";

// Poziva se sa javne registracione strane odmah posle signUp-a — nema
// admin sesije u tom trenutku, pa ne može biti admin-only. Da sadržaj
// mejla ne bi bio proizvoljan tekst iz body-ja, učitavamo pravi red iz
// baze preko ownerId-a i šaljemo SAMO ono što je stvarno upisano.
export async function POST({ request }) {
  try {
    const { ownerId } = await request.json();
    if (!ownerId) {
      return new Response(JSON.stringify({ error: "ownerId is required" }), { status: 400 });
    }

    const db = supabaseAdmin ?? supabase;
    const { data: owner } = await db
      .from("truck_owners")
      .select("company_name, contact_name")
      .eq("id", ownerId)
      .maybeSingle();

    if (!owner) {
      return new Response(JSON.stringify({ error: "owner_not_found" }), { status: 404 });
    }

    const { data: admins, error } = await supabase.rpc('get_admin_emails');
    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 });
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const label = owner.company_name || owner.contact_name || "New owner";

    const results = await Promise.all(
      (admins || []).map((a) =>
        sendEmail({
          to: a.email,
          subject: `New fleet owner application: ${label}`,
          html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
            <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// New Fleet Owner</p>
            <h1 style="font-size:22px; margin:0 0 16px;">New fleet owner application</h1>
            <p style="color:#475569; font-size:14px; line-height:1.6;"><strong>${label}</strong> just signed up as a fleet owner and is waiting for your approval.</p>
            <a href="${siteUrl}/admin/truck-owners" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Review application →</a>
          </div>`,
        })
      )
    );

    return new Response(JSON.stringify({ sent: results.filter((r) => r.ok).length }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'unexpected_error' }), { status: 500 });
  }
}
