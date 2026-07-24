export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail } from "../../lib/resend";

// Poziva se sa kontraktor/vlasnik dashboard-a odmah posle što oni sami
// upišu red u credit_requests (RLS im dozvoljava samo INSERT/SELECT
// sopstvenih zahteva, ne i menjanje statusa) — nema admin sesije u tom
// trenutku, pa ne može biti admin-only. Da sadržaj mejla ne bi bio
// proizvoljan tekst iz body-ja, učitavamo pravi red iz baze preko
// requestId-a i šaljemo SAMO ono što je stvarno upisano.
export async function POST({ request }) {
  try {
    const { requestId } = await request.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId is required" }), { status: 400 });
    }

    const db = supabaseAdmin ?? supabase;
    const { data: creditRequest } = await db
      .from("credit_requests")
      .select("id, account_type, account_id, requested_amount, note, status")
      .eq("id", requestId)
      .maybeSingle();

    if (!creditRequest || creditRequest.status !== "pending") {
      return new Response(JSON.stringify({ error: "request_not_found" }), { status: 404 });
    }

    let accountName = "Account";
    let detailUrl = "/admin";
    if (creditRequest.account_type === "contractor") {
      const { data: contractor } = await db.from("contractors").select("id, company_name").eq("user_id", creditRequest.account_id).maybeSingle();
      accountName = contractor?.company_name || "Contractor";
      if (contractor?.id) detailUrl = `/admin/contractors/${contractor.id}`;
    } else {
      const { data: owner } = await db.from("truck_owners").select("id, company_name").eq("id", creditRequest.account_id).maybeSingle();
      accountName = owner?.company_name || "Truck owner";
      detailUrl = `/admin/truck-owners/${creditRequest.account_id}`;
    }

    const { data: admins, error } = await supabase.rpc("get_admin_emails");
    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500 });
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const amountLine = creditRequest.requested_amount
      ? `requested <strong>$${creditRequest.requested_amount}</strong> in credit`
      : "requested a credit top-up";

    const results = await Promise.all(
      (admins || []).map((a) =>
        sendEmail({
          to: a.email,
          subject: `Credit request: ${accountName}`,
          html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
            <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// Credit Request</p>
            <h1 style="font-size:22px; margin:0 0 16px;">New credit request</h1>
            <p style="color:#475569; font-size:14px; line-height:1.6;"><strong>${accountName}</strong> ${amountLine}.${creditRequest.note ? ` Note: "${creditRequest.note}"` : ""}</p>
            <a href="${siteUrl}${detailUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Review & top up →</a>
          </div>`,
        })
      )
    );

    return new Response(JSON.stringify({ sent: results.filter((r) => r.ok).length }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), { status: 500 });
  }
}
