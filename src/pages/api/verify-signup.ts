export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { createProfileRow, notifyAdmins } from "./signup";

export async function GET({ request }: { request: Request }) {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;
  const redirect = (path: string) => new Response(null, { status: 302, headers: { Location: `${siteUrl}${path}` } });

  if (!supabaseAdmin) return redirect("/login?verify=error");

  const token = new URL(request.url).searchParams.get("token");
  if (!token) return redirect("/login?verify=error");

  const { data: pending } = await supabaseAdmin.from("pending_signups").select("*").eq("token", token).maybeSingle();
  if (!pending) return redirect("/login?verify=invalid");
  if (new Date(pending.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("pending_signups").delete().eq("id", pending.id);
    return redirect("/login?verify=expired");
  }

  const payload = pending.payload as Record<string, string | null>;
  const insertError = await createProfileRow(pending.role as "contractor" | "truck_owner", pending.user_id, {
    email: payload.email || "",
    companyName: payload.companyName ?? null,
    contactName: payload.contactName ?? null,
    phone: payload.phone ?? null,
    territory: payload.territory ?? null,
    source: payload.source ?? null,
    claimSlug: payload.claimSlug ?? null,
  });

  await supabaseAdmin.from("pending_signups").delete().eq("id", pending.id);

  if (insertError) return redirect("/login?verify=error");
  notifyAdmins(pending.role as "contractor" | "truck_owner", pending.user_id, request).catch((err) => console.error("notify admins failed:", err));
  return redirect("/login?verify=success");
}
