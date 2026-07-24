export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

export async function GET({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [
      { count: total },
      { count: active },
      { count: archived },
      { count: newStatus },
      { count: invited },
      { count: converted },
    ] = await Promise.all([
      supabaseAdmin.from("permit_leads").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("permit_leads").select("*", { count: "exact", head: true }).is("archived_at", null),
      supabaseAdmin.from("permit_leads").select("*", { count: "exact", head: true }).not("archived_at", "is", null),
      supabaseAdmin.from("permit_leads").select("*", { count: "exact", head: true }).eq("permit_status", "new").is("archived_at", null),
      supabaseAdmin.from("permit_leads").select("*", { count: "exact", head: true }).eq("permit_status", "invited").is("archived_at", null),
      supabaseAdmin.from("permit_leads").select("*", { count: "exact", head: true }).eq("permit_status", "converted").is("archived_at", null),
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        stats: {
          total: total ?? 0,
          active: active ?? 0,
          archived: archived ?? 0,
          new: newStatus ?? 0,
          invited: invited ?? 0,
          converted: converted ?? 0,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
