// Server-only helper — NIKAD ne importuj ovo u <script> (client) blok,
// samo u .astro frontmatter ili u src/pages/api/*.ts fajlove.
// RESEND_API_KEY namerno NIJE prefiksovan sa PUBLIC_, pa Astro
// ne sme da ga ubaci u JS bundle koji ide u browser.

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.RESEND_FROM_EMAIL || "SawFleet <onboarding@resend.dev>";

/**
 * @param {{ to: string | string[], subject: string, html: string }} params
 */
export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY nije podešen u .env — email nije poslat.");
    return { ok: false, error: "missing_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      return { ok: false, error: errText };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.error("Resend request failed:", err);
    return { ok: false, error: String(err) };
  }
}

// ================= EMAIL TEMPLATES =================

export function newLeadEmailHtml({ companyName, county, details, dashboardUrl }) {
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#0B0F0C; color:#F8FAF9; padding:32px; border-radius:16px;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#4CAF50; font-weight:bold; margin:0 0 12px;">// New Dispatch</p>
    <h1 style="font-size:22px; margin:0 0 16px;">Novi lid u tvojoj teritoriji</h1>
    <p style="color:#CDD5CF; font-size:14px; line-height:1.6;">Zdravo${companyName ? " " + companyName : ""}, stigao je novi zahtev za tree service u <strong>${county}</strong>.</p>
    <p style="color:#8A958D; font-size:13px; line-height:1.6; border-left:2px solid #333; padding-left:12px;">${details ? details.slice(0, 140) : "Detalji dostupni nakon prijave."}</p>
    <p style="color:#F59E0B; font-size:12px; margin:20px 0;">⚡ Prvi koji preuzme, jedini dobija kontakt podatke.</p>
    <a href="${dashboardUrl}" style="display:inline-block; margin-top:8px; background:#4CAF50; color:#0B0F0C; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Preuzmi lid →</a>
  </div>`;
}

export function contractorStatusEmailHtml({ companyName, status, loginUrl }) {
  const approved = status === "active";
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#0B0F0C; color:#F8FAF9; padding:32px; border-radius:16px;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:${approved ? "#4CAF50" : "#EF4444"}; font-weight:bold; margin:0 0 12px;">// Account ${approved ? "Approved" : "Update"}</p>
    <h1 style="font-size:22px; margin:0 0 16px;">${approved ? "Nalog je odobren!" : "Status naloga je ažuriran"}</h1>
    <p style="color:#CDD5CF; font-size:14px; line-height:1.6;">
      Zdravo${companyName ? " " + companyName : ""}, ${approved
        ? "tvoj profil izvođača je odobren. Od sada možeš da vidiš i preuzimaš dostupne lidove."
        : "nažalost tvoj profil trenutno nije odobren. Kontaktiraj administratora za više informacija."}
    </p>
    ${approved ? `<a href="${loginUrl}" style="display:inline-block; margin-top:8px; background:#4CAF50; color:#0B0F0C; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Uloguj se →</a>` : ""}
  </div>`;
}
