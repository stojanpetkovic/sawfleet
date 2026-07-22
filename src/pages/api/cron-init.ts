export const prerender = false;

import { initPermitSyncCron } from "../../lib/permitCron";

let cronInitialized = false;

/**
 * Initializes permit sync cron job on first request
 * Called automatically by admin pages on load
 */
export async function POST() {
  try {
    if (!cronInitialized) {
      initPermitSyncCron();
      cronInitialized = true;
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Permit sync cron job initialized",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Permit sync cron job already initialized",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Failed to initialize cron",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
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
