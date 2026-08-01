import { createClient } from "@supabase/supabase-js";

// Verifies a logged-in contractor/truck-owner's OWN session (unlike
// automationAuth.ts, which requires is_admin()). Used by endpoints that must
// run server-side (e.g. to call a third-party API with a secret) but act on
// behalf of the calling end user, not an admin.
export async function authenticateUser(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { authenticated: false, user: null };

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return { authenticated: false, user: null };

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return { authenticated: false, user: null };
  return { authenticated: true, user };
}
