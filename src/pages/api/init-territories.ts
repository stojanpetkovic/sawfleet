export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

const TERRITORIES = [
  "Broward County",
  "City of Boca Raton",
  "City of Coral Gables",
  "City of Doral",
  "City of Fort Lauderdale",
  "City of Hallandale Beach",
  "City of Miami",
  "City of Miami Gardens",
  "City of Naples",
  "City of Oakland Park",
  "Collier County",
  "Miami-Dade County",
  "Palm Beach County",
  "Town of Jupiter",
  "Village of Wellington"
];

export async function POST() {
  try {
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: "service_role_not_configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get existing territories
    const { data: existing } = await supabaseAdmin
      .from("service_territories")
      .select("name")
      .in("name", TERRITORIES);

    const existingNames = new Set((existing || []).map((t: any) => t.name));
    const toAdd = TERRITORIES.filter(t => !existingNames.has(t));

    if (toAdd.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "All territories already exist", added: 0, total: TERRITORIES.length }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert missing territories
    const { error, data } = await supabaseAdmin
      .from("service_territories")
      .insert(toAdd.map(name => ({ name })))
      .select();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Added ${toAdd.length} territories`,
        added: toAdd,
        total: TERRITORIES.length 
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
