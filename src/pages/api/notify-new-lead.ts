export const prerender = false;

import { supabase } from "../../lib/supabase";
import { sendEmail, newLeadEmailHtml } from "../../lib/resend";

// Poziva se sa javne landing stranice odmah nakon što posetilac
// pošalje formu za lid. Šalje email svim AKTIVNIM kontraktorima
// u toj teritoriji da imaju novi lid za preuzimanje.
export async function POST({ request }) {
  try {
    const { county, details } = await request.json();

    if (!county) {
      return new Response(JSON.stringify({ error: "county is required" }), { status: 400 });
    }

    const { data: contractors, error } = await supabase
      .from("contractors")
      .select("company_name, email")
      .eq("territory", county)
      .eq("status", "active")
      .not("email", "is", null);

    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500 });
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
    const dashboardUrl = `${siteUrl}/dashboard`;

    const results = await Promise.all(
      (contractors || []).map((c) =>
        sendEmail({
          to: c.email,
          subject: `Novi lid u ${county} — SawFleet`,
          html: newLeadEmailHtml({ companyName: c.company_name, county, details, dashboardUrl }),
        })
      )
    );

    const sent = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ sent, total: contractors?.length || 0 }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "unexpected_error" }), { status: 500 });
  }
}
