export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

/**
 * Unarchive (reactivate) a single permit lead
 * POST /api/unarchive-lead with JSON body: { id: string }
 */
export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { id } = await request.json();

    if (!id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing lead ID",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[UNARCHIVE LEAD] Reactivating lead ${id}`);

    const { data, error } = await supabaseAdmin
      .from("permit_leads")
      .update({
        archived_at: null,
        archive_reason: null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[UNARCHIVE LEAD] Reactivation failed:", error);
      throw error;
    }

    console.log(`[UNARCHIVE LEAD] Lead ${id} reactivated successfully`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Lead reactivated successfully",
        lead: data,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[UNARCHIVE LEAD] Error:", error);
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMsg,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
