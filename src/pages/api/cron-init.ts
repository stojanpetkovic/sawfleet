export const prerender = false;

/**
 * The process-local scheduler has been retired. Production scheduling is
 * managed by Supabase Cron so restarts and horizontal scaling cannot create
 * missed or duplicate intervals.
 */
export async function POST() {
  return new Response(JSON.stringify({
    ok: false,
    error: "process_scheduler_retired",
    message: "Permit sync is scheduled through Supabase Cron.",
  }), { status: 410, headers: { "Content-Type": "application/json" } });
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Use POST to initialize permit sync cron",
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
