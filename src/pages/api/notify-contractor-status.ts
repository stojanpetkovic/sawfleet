export const prerender = false;

import { supabase } from "../../lib/supabase";
import { sendEmail, contractorStatusEmailHtml } from "../../lib/resend";

// Poziva se iz admin panela kad se odobri/odbije kontraktor.
export async function POST({ request }) {
  try {
    const { contractorId, status } = await request.json();
    if (!contractorId || !status) {
      return new Response(JSON.stringify({ error: "contractorId and status are required" }), { status: 400 });
    }

    const { data: contractor, error } = await supabase
      .from("contractors")
      .select("company_name, email")
      .eq("id", contractorId)
      .single();

    if (error || !contractor?.email) {
      return new Response(JSON.stringify({ error: "contractor_not_found" }), { status: 404 });
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

    const result = await sendEmail({
      to: contractor.email,
      subject: status === "active" ? "Tvoj SawFleet nalog je odobren" : "Status tvog SawFleet naloga",
      html: contractorStatusEmailHtml({
        companyName: contractor.company_name,
        status,
        loginUrl: `${siteUrl}/login`,
      }),
    });

    return new Response(JSON.stringify({ sent: result.ok }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), { status: 500 });
  }
}
