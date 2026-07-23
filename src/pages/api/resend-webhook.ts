export const prerender = false;
import { supabaseAdmin } from "../../lib/supabaseAdmin";

function base64Bytes(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

export async function POST({ request }: { request: Request }) {
  const secret = import.meta.env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get("svix-id") || "";
  const timestamp = request.headers.get("svix-timestamp") || "";
  const signatures = request.headers.get("svix-signature") || "";
  const raw = await request.text();
  if (!secret || !id || !timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return new Response("Unauthorized", { status: 401 });
  try {
    const key = base64Bytes(secret.replace(/^whsec_/, ""));
    const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${raw}`)));
    const valid = signatures.split(" ").some((part) => {
      const encoded = part.startsWith("v1,") ? part.slice(3) : "";
      return encoded ? safeEqual(digest, base64Bytes(encoded)) : false;
    });
    if (!valid) return new Response("Unauthorized", { status: 401 });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const event = JSON.parse(raw);
  const emailId = event?.data?.email_id;
  const mapping: Record<string, string> = { "email.delivered": "delivered", "email.bounced": "bounced", "email.complained": "complained" };
  const status = mapping[event?.type];
  if (emailId && status && supabaseAdmin) {
    const now = new Date().toISOString();
    let update = supabaseAdmin.from("truck_profile_outreach").update({
      status,
      ...(status === "delivered" ? { delivered_at: now } : {}),
      updated_at: now,
    }).eq("resend_email_id", emailId);
    if (status === "delivered") update = update.in("status", ["queued", "sent"]);
    await update;
    let permitUpdate = supabaseAdmin.from("permit_outreach_events").update({
      status,
      ...(status === "delivered" ? { delivered_at: now } : {}),
      updated_at: now,
    }).eq("resend_email_id", emailId);
    if (status === "delivered") permitUpdate = permitUpdate.in("status", ["queued", "sent"]);
    await permitUpdate;
  }
  return new Response("ok");
}
