import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY klijent sa punim (service_role) pristupom.
// NIKAD ne importuj ovo u <script> (browser) blok — samo u .astro
// frontmatter ili src/pages/api/*.ts fajlove. SUPABASE_SERVICE_ROLE_KEY
// namerno nema PUBLIC_ prefiks, pa Astro ga ne sme ubaciti u JS bundle
// koji ide u browser.

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
