import { createClient } from "@supabase/supabase-js";

export async function authorizeAutomationRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const cronSecret = import.meta.env.CRON_SECRET || "";

  if (cronSecret && token === cronSecret) {
    return { authorized: true, actor: "production_cron" };
  }

  if (!token) {
    return { authorized: false, actor: null };
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { authorized: false, actor: null };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return { authorized: false, actor: null };
  const { data: isAdmin } = await userClient.rpc("is_admin");
  return { authorized: isAdmin === true, actor: isAdmin ? user.email || user.id : null };
}
