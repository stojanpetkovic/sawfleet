export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

/**
 * Manually archive a single permit lead
 * POST /api/archive-lead with JSON body: { id: string, reason?: string }
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

    const { id, reason } = await request.json();

    if (!id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing lead ID",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[ARCHIVE LEAD] Archiving lead ${id}`);

    const { data, error } = await supabaseAdmin
      .from("permit_leads")
      .update({
        archived_at: new Date().toISOString(),
        archive_reason: reason || "Manually archived",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[ARCHIVE LEAD] Archive failed:", error);
      throw error;
    }

    console.log(`[ARCHIVE LEAD] Lead ${id} archived successfully`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Lead archived successfully",
        lead: data,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ARCHIVE LEAD] Error:", error);
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
