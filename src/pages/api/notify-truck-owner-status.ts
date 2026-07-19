export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { sendEmail, truckOwnerStatusEmailHtml } from "../../lib/resend";

// Poziva se iz admin panela kad se odobri/odbije vlasnik kamiona.
export async function POST({ request }) {
  try {
    const { ownerId, status } = await request.json();
    if (!ownerId || !status) {
      return new Response(JSON.stringify({ error: "ownerId and status are required" }), { status: 400 });
    }

    // Server-to-server poziv, nema korisničke sesije — mora service role
    const db = supabaseAdmin ?? supabase;

    const { data: owner, error } = await db
      .from("truck_owners")
      .select("company_name, contact_name, email")
      .eq("id", ownerId)
      .single();

    if (error || !owner?.email) {
      return new Response(JSON.stringify({ error: "owner_not_found" }), { status: 404 });
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

    const result = await sendEmail({
      to: owner.email,
      subject: status === "approved" ? "Tvoj SF Tree Removal fleet nalog je odobren" : "Status tvog SF Tree Removal fleet naloga",
      html: truckOwnerStatusEmailHtml({
        ownerName: owner.company_name || owner.contact_name,
        status,
        loginUrl: `${siteUrl}/truck-login`,
      }),
    });

    return new Response(JSON.stringify({ sent: result.ok }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), { status: 500 });
  }
}
