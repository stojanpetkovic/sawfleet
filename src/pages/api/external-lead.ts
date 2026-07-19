export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { notifyNewExternalLead } from "./notify-new-external-lead";

// CORS — ovo namerno prima pozive sa DRUGIH domena (spoljni sajtovi
// šalju svoje forme ovde), pa je Access-Control-Allow-Origin otvoren.
// Ako kasnije poželiš da ograničiš na tačno određene domene, ovde je
// mesto — zameni "*" sa proverom protiv liste dozvoljenih domena.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST({ request }: { request: Request }) {
  try {
    if (!supabaseAdmin) {
      return json({ error: "service_role_not_configured" }, 500);
    }

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "invalid_json" }, 400);

    // Honeypot — skriveno polje koje pravi ljudi nikad ne popune, ali
    // botovi često upišu nešto u svako polje forme. Ako je popunjeno,
    // tiho odbijamo (ne javljamo botu da smo ga prepoznali).
    if (body.website || body.hp_field) {
      return json({ ok: true }, 200);
    }

    const {
      formType,       // 'lead' | 'job'
      sourceDomain,   // koji sajt šalje — ako nije poslat, uzimamo iz Origin/Referer header-a
      fullName,
      email,
      phone,
      message,
      smsConsent,
      smsConsentText,
      extra,          // slobodna torba za polja specifična za formu
      photos,         // niz base64 data-url stringova (npr. "data:image/jpeg;base64,...."), najviše 4
    } = body;

    if (!fullName || (!email && !phone)) {
      return json({ error: "invalid_input", message: "Full name and at least one of email/phone are required." }, 400);
    }

    const origin = request.headers.get("origin") || request.headers.get("referer") || "";
    let resolvedDomain = sourceDomain || null;
    if (!resolvedDomain && origin) {
      try { resolvedDomain = new URL(origin).hostname; } catch { /* ignore */ }
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;

    const { data: inserted, error } = await supabaseAdmin.from("external_leads").insert([{
      form_type: formType || "lead",
      source_domain: resolvedDomain,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      message: message || null,
      sms_consent: !!smsConsent,
      sms_consent_text: smsConsentText || null,
      status: "new",
      extra: extra || null,
      ip_address: ip,
      user_agent: userAgent,
    }]).select().single();

    if (error) {
      return json({ error: "insert_failed", message: error.message }, 500);
    }

    // Upload fotografija (best effort — ako neka padne, ostale se i
    // dalje čuvaju, ne rušimo ceo submit zbog jedne slike).
    let photoUrls: string[] = [];
    if (Array.isArray(photos) && photos.length > 0) {
      const uploads = await Promise.all(
        photos.slice(0, 4).map(async (dataUrl: string, i: number) => {
          try {
            const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
            if (!match) return null;
            const [, mimeType, base64Data] = match;
            const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
            const buffer = Buffer.from(base64Data, "base64");
            const path = `${inserted.id}/${i + 1}.${ext}`;

            const { error: uploadError } = await supabaseAdmin!.storage
              .from("external-lead-photos")
              .upload(path, buffer, { contentType: mimeType, upsert: true });

            if (uploadError) {
              console.error("Photo upload failed:", uploadError.message);
              return null;
            }

            const { data: publicUrl } = supabaseAdmin!.storage.from("external-lead-photos").getPublicUrl(path);
            return publicUrl.publicUrl;
          } catch (err) {
            console.error("Photo processing failed:", err);
            return null;
          }
        })
      );
      photoUrls = uploads.filter((u): u is string => !!u);

      if (photoUrls.length > 0) {
        await supabaseAdmin.from("external_leads").update({
          extra: { ...(extra || {}), photoUrls },
        }).eq("id", inserted.id);
      }
    }

    // Obavesti admina/podešene adrese SAMO ako je "Immediately on arrival"
    // izabrano u Settings -> Notifications. Ako je "Only after it's
    // approved", ništa se ne šalje ovde — čeka se klik na Approve
    // dugme na /admin/external-leads.
    const { data: notifySettings } = await supabaseAdmin
      .from("tracking_settings")
      .select("external_lead_notify_on_approval_only")
      .eq("id", 1)
      .single();

    if (!notifySettings?.external_lead_notify_on_approval_only) {
      const siteUrl = import.meta.env.PUBLIC_SITE_URL || origin || new URL(request.url).origin;
      notifyNewExternalLead(
        { fullName, email, phone, message, sourceDomain: resolvedDomain, formType: formType || "lead", photoUrls },
        siteUrl
      ).catch((err) => console.error("notifyNewExternalLead failed:", err));
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "unexpected_error", message: String(err) }, 500);
  }
}
