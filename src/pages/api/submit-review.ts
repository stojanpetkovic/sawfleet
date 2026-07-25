export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// SHA-256 of client IP for basic duplicate/spam detection (not stored as plain IP)
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + process.env.SUPABASE_SALT || ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST({ request }: { request: Request }) {
  if (!supabaseAdmin) {
    return json({ error: "service_role_not_configured" }, 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { contractor_id, rating, reviewer_name, body: reviewBody } = body as Record<string, unknown>;

  // Validate inputs
  if (!contractor_id || typeof contractor_id !== "string") {
    return json({ error: "invalid_input", message: "contractor_id is required." }, 400);
  }
  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return json({ error: "invalid_input", message: "rating must be an integer between 1 and 5." }, 400);
  }
  if (reviewer_name !== null && reviewer_name !== undefined && typeof reviewer_name !== "string") {
    return json({ error: "invalid_input", message: "reviewer_name must be a string or null." }, 400);
  }
  if (reviewBody !== null && reviewBody !== undefined && typeof reviewBody !== "string") {
    return json({ error: "invalid_input", message: "body must be a string or null." }, 400);
  }

  // Sanitise lengths
  const safeReviewerName = typeof reviewer_name === "string" ? reviewer_name.trim().slice(0, 80) || null : null;
  const safeBody = typeof reviewBody === "string" ? reviewBody.trim().slice(0, 1000) || null : null;

  // Check contractor exists and is public/active
  const { data: contractor } = await supabaseAdmin
    .from("contractors")
    .select("id, is_public, status")
    .eq("id", contractor_id)
    .maybeSingle();

  if (!contractor || !contractor.is_public || contractor.status !== "active") {
    return json({ error: "not_found", message: "Contractor profile not found." }, 404);
  }

  // Basic rate limit: max 3 reviews from the same IP hash per contractor per 24 h
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("cf-connecting-ip")
    || "unknown";
  const ipHash = await hashIp(clientIp);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("contractor_reviews")
    .select("id", { count: "exact", head: true })
    .eq("contractor_id", contractor_id)
    .eq("ip_hash", ipHash)
    .gte("created_at", since);

  if ((count ?? 0) >= 3) {
    return json({ error: "rate_limited", message: "Too many reviews submitted. Please try again tomorrow." }, 429);
  }

  // Insert review (status = pending, will be approved by admin)
  const { error: insertError } = await supabaseAdmin.from("contractor_reviews").insert([{
    contractor_id,
    rating: ratingNum,
    reviewer_name: safeReviewerName,
    body: safeBody,
    status: "pending",
    ip_hash: ipHash,
  }]);

  if (insertError) {
    console.error("[submit-review]", insertError);
    return json({ error: "insert_failed", message: insertError.message }, 500);
  }

  return json({ ok: true }, 200);
}
