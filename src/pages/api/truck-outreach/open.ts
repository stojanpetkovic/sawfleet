export const prerender = false;
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const pixel = Uint8Array.from(atob("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="), (char) => char.charCodeAt(0));

export async function GET({ url }: { url: URL }) {
  const token = url.searchParams.get("token");
  if (token && supabaseAdmin) {
    const { data } = await supabaseAdmin.from("truck_profile_outreach").select("id,status,opened_at").eq("tracking_token", token).maybeSingle();
    if (data && !["bounced", "complained", "unsubscribed"].includes(data.status)) {
      await supabaseAdmin.from("truck_profile_outreach").update({
        status: data.status === "clicked" ? "clicked" : "opened",
        opened_at: data.opened_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", data.id);
    }
  }
  return new Response(pixel, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache, must-revalidate" } });
}

