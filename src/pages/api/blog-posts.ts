export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

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

async function uploadCoverImage(postId: string, dataUrl: string): Promise<string | null> {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mimeType, base64Data] = match;
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") || "jpg";
  const buffer = Buffer.from(base64Data, "base64");
  const path = `${postId}/cover.${ext}`;

  const { error: uploadError } = await supabaseAdmin!.storage
    .from("blog-post-covers")
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) {
    console.error("Blog cover upload failed:", uploadError.message);
    return null;
  }

  const { data: publicUrl } = supabaseAdmin!.storage.from("blog-post-covers").getPublicUrl(path);
  return publicUrl.publicUrl;
}

export const GET: APIRoute = async ({ request, url }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const id = url.searchParams.get("id");
  if (id) {
    const { data, error } = await supabaseAdmin.from("blog_posts").select("*").eq("id", id).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, post: data });
  }

  let query = supabaseAdmin.from("blog_posts").select("*").order("created_at", { ascending: false });
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q");
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);

  const { data, error } = await query.limit(500);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, posts: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "invalid_json" }, 400);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return json({ ok: false, error: "title is required" }, 400);

  const status = body.status === "published" ? "published" : "draft";
  const fields = {
    title,
    excerpt: typeof body.excerpt === "string" ? body.excerpt.trim().slice(0, 200) : null,
    content: typeof body.content === "string" ? body.content : "",
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : null,
    tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string").map((t: string) => t.trim()).filter(Boolean) : [],
    status,
    meta_title: typeof body.meta_title === "string" ? body.meta_title.trim().slice(0, 200) || null : null,
    meta_description: typeof body.meta_description === "string" ? body.meta_description.trim().slice(0, 300) || null : null,
  };

  const coverImageBase64 = typeof body.coverImageBase64 === "string" ? body.coverImageBase64 : null;

  if (body.id) {
    // Update existing post
    const { data: existing, error: existingError } = await supabaseAdmin.from("blog_posts").select("id, status, published_at").eq("id", body.id).maybeSingle();
    if (existingError) return json({ ok: false, error: existingError.message }, 500);
    if (!existing) return json({ ok: false, error: "not_found" }, 404);

    const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
    if (status === "published" && !existing.published_at) {
      update.published_at = new Date().toISOString();
    }

    if (coverImageBase64) {
      const coverUrl = await uploadCoverImage(existing.id, coverImageBase64);
      if (coverUrl) update.cover_image_url = coverUrl;
    }

    const { data, error } = await supabaseAdmin.from("blog_posts").update(update).eq("id", existing.id).select().single();
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, post: data });
  }

  // Create new post — generate a unique slug, retry once on collision
  const newId = crypto.randomUUID();
  let slug = slugify(title, newId);
  const insertPayload: Record<string, unknown> = {
    id: newId,
    ...fields,
    slug,
    published_at: status === "published" ? new Date().toISOString() : null,
  };

  let { data: created, error: insertError } = await supabaseAdmin.from("blog_posts").insert([insertPayload]).select().single();

  if (insertError && (insertError as any).code === "23505") {
    const retryId = crypto.randomUUID();
    slug = slugify(title, retryId);
    ({ data: created, error: insertError } = await supabaseAdmin
      .from("blog_posts")
      .insert([{ ...insertPayload, id: retryId, slug }])
      .select()
      .single());
  }

  if (insertError) return json({ ok: false, error: insertError.message }, 500);

  if (coverImageBase64 && created) {
    const coverUrl = await uploadCoverImage(created.id, coverImageBase64);
    if (coverUrl) {
      const { data: updated } = await supabaseAdmin.from("blog_posts").update({ cover_image_url: coverUrl }).eq("id", created.id).select().single();
      if (updated) created = updated;
    }
  }

  return json({ ok: true, post: created });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const id = url.searchParams.get("id");
  if (!id) return json({ ok: false, error: "id is required" }, 400);

  try {
    const { data: files } = await supabaseAdmin.storage.from("blog-post-covers").list(id);
    if (files?.length) {
      await supabaseAdmin.storage.from("blog-post-covers").remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch (e) {
    console.error("blog cover cleanup failed", e);
  }

  const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", id);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
