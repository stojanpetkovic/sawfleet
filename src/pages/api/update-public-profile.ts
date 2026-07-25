export const prerender = false;

import { supabase } from "../../lib/supabase";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ALLOWED_SERVICES = [
  "Tree Removal",
  "Tree Trimming",
  "Stump Grinding",
  "Emergency Service",
  "Land Clearing",
  "Debris Removal",
  "Crane Service",
];

function slugify(text: string, id: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) +
    "-" +
    id.slice(0, 8)
  );
}

export async function POST({ request }: { request: Request }) {
  // Must be authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return json({ error: "unauthenticated" }, 401);

  if (!supabaseAdmin) return json({ error: "service_role_not_configured" }, 500);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { bio, website, license_number, services_offered, is_public } = body as Record<string, unknown>;

  // Validate website URL if provided
  if (website && typeof website === "string" && website.trim()) {
    try {
      const u = new URL(website.trim());
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
    } catch {
      return json({ error: "invalid_input", message: "website must be a valid http/https URL." }, 400);
    }
  }

  // Validate services_offered is a subset of allowed values
  if (services_offered !== undefined && services_offered !== null) {
    if (!Array.isArray(services_offered)) {
      return json({ error: "invalid_input", message: "services_offered must be an array." }, 400);
    }
    for (const s of services_offered as unknown[]) {
      if (!ALLOWED_SERVICES.includes(s as string)) {
        return json({ error: "invalid_input", message: `Unknown service: ${s}` }, 400);
      }
    }
  }

  // Look up contractor record for the authenticated user
  const { data: contractor } = await supabaseAdmin
    .from("contractors")
    .select("id, company_name, slug, status")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (!contractor) return json({ error: "not_found", message: "No contractor profile found for this user." }, 404);
  if (contractor.status !== "active") return json({ error: "forbidden", message: "Profile must be active to publish." }, 403);

  // Generate slug if not already set
  let slug = contractor.slug;
  if (!slug) {
    slug = slugify(contractor.company_name || "contractor", contractor.id);
  }

  const update: Record<string, unknown> = { slug };
  if (bio !== undefined) update.bio = typeof bio === "string" ? bio.trim().slice(0, 2000) || null : null;
  if (website !== undefined) update.website = typeof website === "string" && website.trim() ? website.trim() : null;
  if (license_number !== undefined) update.license_number = typeof license_number === "string" ? license_number.trim().slice(0, 100) || null : null;
  if (services_offered !== undefined) update.services_offered = Array.isArray(services_offered) ? services_offered : [];
  if (is_public !== undefined) update.is_public = Boolean(is_public);

  const { error: updateError } = await supabaseAdmin
    .from("contractors")
    .update(update)
    .eq("id", contractor.id);

  if (updateError) {
    console.error("[update-public-profile]", updateError);
    return json({ error: "update_failed", message: updateError.message }, 500);
  }

  return json({ ok: true, slug }, 200);
}
