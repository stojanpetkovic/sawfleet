// Server-only helper — NIKAD ne importuj ovo u <script> (client) blok,
// samo u .astro frontmatter ili u src/pages/api/*.ts fajlove.

// VAŽNO: mejlovi se NE šalju direktno sa Railway servera ka Resend-u —
// Resend odbija SVE pozive sa Railway IP opsega generičkom "API key is
// invalid" greškom (potvrđeno: čak i namerno pogrešan ključ dobija
// istu grešku, dok isti nalog radi savršeno preko drugog kanala).
// Zato ide preko Supabase Edge Function-a ("send-notification-email"),
// koji šalje ka Resend-u sa Supabase infrastrukture umesto Railway-a.

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const FROM_EMAIL = import.meta.env.RESEND_FROM_EMAIL || "SF Tree Removal <notifications@sftreeremoval.com>";

/**
 * @param {{ to: string | string[], subject: string, html: string }} params
 */
export async function sendEmail({ to, subject, html }) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY nisu podešeni — email nije poslat.");
    return { ok: false, error: "missing_supabase_config" };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, subject, html, from: FROM_EMAIL }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      console.error("Edge function email error:", res.status, data);
      return { ok: false, error: JSON.stringify(data) };
    }

    return { ok: true, data: data.data };
  } catch (err) {
    console.error("Edge function request failed:", err);
    return { ok: false, error: String(err) };
  }
}

// ================= EMAIL TEMPLATES =================

export function newLeadEmailHtml({ companyName, county, details, dashboardUrl }) {
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// New Dispatch</p>
    <h1 style="font-size:22px; margin:0 0 16px;">Novi lid u tvojoj teritoriji</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">Zdravo${companyName ? " " + companyName : ""}, stigao je novi zahtev za tree service u <strong>${county}</strong>.</p>
    <p style="color:#64748B; font-size:13px; line-height:1.6; border-left:2px solid #E2E8F0; padding-left:12px;">${details ? details.slice(0, 140) : "Detalji dostupni nakon prijave."}</p>
    <p style="color:#D97706; font-size:12px; margin:20px 0;">⚡ Prvi koji preuzme, jedini dobija kontakt podatke.</p>
    <a href="${dashboardUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Preuzmi lid →</a>
  </div>`;
}

export function contractorStatusEmailHtml({ companyName, status, loginUrl }) {
  const approved = status === "active";
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:${approved ? "#16803C" : "#DC2626"}; font-weight:bold; margin:0 0 12px;">// Account ${approved ? "Approved" : "Update"}</p>
    <h1 style="font-size:22px; margin:0 0 16px;">${approved ? "Nalog je odobren!" : "Status naloga je ažuriran"}</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">
      Zdravo${companyName ? " " + companyName : ""}, ${approved
        ? "tvoj profil izvođača je odobren. Od sada možeš da vidiš i preuzimaš dostupne lidove."
        : "nažalost tvoj profil trenutno nije odobren. Kontaktiraj administratora za više informacija."}
    </p>
    ${approved ? `<a href="${loginUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Uloguj se →</a>` : ""}
  </div>`;
}

export function truckOwnerStatusEmailHtml({ ownerName, status, loginUrl }) {
  const approved = status === "approved";
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:${approved ? "#16803C" : "#DC2626"}; font-weight:bold; margin:0 0 12px;">// Fleet Account ${approved ? "Approved" : "Update"}</p>
    <h1 style="font-size:22px; margin:0 0 16px;">${approved ? "Nalog je odobren!" : "Status naloga je ažuriran"}</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">
      Zdravo${ownerName ? " " + ownerName : ""}, ${approved
        ? "tvoj fleet owner nalog je odobren. Od sada možeš da dodaješ kamione i primaš dispečerske zahteve."
        : "nažalost tvoj fleet owner nalog trenutno nije odobren. Kontaktiraj administratora za više informacija."}
    </p>
    ${approved ? `<a href="${loginUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Uloguj se →</a>` : ""}
  </div>`;
}
