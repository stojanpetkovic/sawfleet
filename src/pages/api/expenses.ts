export const prerender = false;

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { authorizeAutomationRequest } from "../../lib/automationAuth";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const GET: APIRoute = async ({ request, url }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  let query = supabaseAdmin.from("expenses").select("*").order("expense_date", { ascending: false });
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from) query = query.gte("expense_date", from);
  if (to) query = query.lte("expense_date", to);

  const { data, error } = await query.limit(500);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, expenses: data || [] });
};

export const POST: APIRoute = async ({ request }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category.trim().slice(0, 100) : "";
  const amount = Number(body?.amount);
  const expenseDate = typeof body?.expense_date === "string" && body.expense_date ? body.expense_date : new Date().toISOString().slice(0, 10);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

  if (!category || !Number.isFinite(amount) || amount <= 0) {
    return json({ ok: false, error: "category and a positive amount are required" }, 400);
  }

  const { data, error } = await supabaseAdmin.from("expenses").insert([{
    category,
    amount,
    expense_date: expenseDate,
    note,
    created_by: authorization.actor || "admin",
  }]).select().single();

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, expense: data });
};

export const DELETE: APIRoute = async ({ request, url }) => {
  const authorization = await authorizeAutomationRequest(request);
  if (!authorization.authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (!supabaseAdmin) return json({ ok: false, error: "service_role_not_configured" }, 500);

  const id = url.searchParams.get("id");
  if (!id) return json({ ok: false, error: "id is required" }, 400);

  const { error } = await supabaseAdmin.from("expenses").delete().eq("id", id);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true });
};
