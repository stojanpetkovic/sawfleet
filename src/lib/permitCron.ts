let syncInterval: any = null;

const PERMIT_SYNC_INTERVAL_MS = 
  (parseInt(process.env.PERMIT_SYNC_INTERVAL_HOURS || "6") * 60 * 60 * 1000);

/**
 * Initializes the permit lead sync interval job
 * Runs every 6 hours by default (PERMIT_SYNC_INTERVAL_HOURS env var)
 */
export function initPermitSyncCron() {
  // Prevent multiple job instances
  if (syncInterval) {
    console.log("[CRON] Permit sync interval already initialized");
    return;
  }

  try {
    // Run permit sync immediately on init
    runPermitSync();

    // Then schedule recurring syncs
    syncInterval = setInterval(
      runPermitSync,
      PERMIT_SYNC_INTERVAL_MS
    );

    console.log(
      `[CRON] Permit sync interval initialized (every ${PERMIT_SYNC_INTERVAL_MS / (1000 * 60 * 60)} hours)`
    );
  } catch (error: any) {
    console.error("[CRON] Failed to initialize permit sync interval:", error);
  }
}

async function runPermitSync() {
  console.log(`[CRON] Triggering permit sync at ${new Date().toISOString()}`);

  try {
    const baseUrl = process.env.PUBLIC_SITE_URL || "http://localhost:4321";
    const response = await fetch(`${baseUrl}/api/permit-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const result = await response.json();
    if (result.ok) {
      console.log(
        `[CRON] Permit sync completed: ${result.created} new permits synced`
      );
    } else {
      console.error("[CRON] Permit sync failed:", result.error);
    }
  } catch (error: any) {
    console.error("[CRON] Permit sync error:", error?.message);
  }
}

/**
 * Stops the permit sync cron interval
 */
export function stopPermitSyncCron() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[CRON] Permit sync interval stopped");
  }
}
