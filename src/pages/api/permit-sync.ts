export const prerender = false;

import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { buildPermitOutreachEmail, getPermitLeads, getPermitAutomationSettings, savePermitAutomationSettings } from "../../lib/permitData";
import { sendEmail } from "../../lib/resend";
import { authorizeAutomationRequest } from "../../lib/automationAuth";
import { runTruckOutreachBatch } from "../../lib/truckOutreach";
import { processCreditAutoRefill } from "../../lib/creditSystem";

/**
 * Autonomous permit lead scraping and sync to external_leads table.
 * This is the primary data source for the permit leads dashboard.
 * Called by: cron jobs, manual triggers, or automated systems
 */
export async function POST({ request }: { request: Request }) {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.log(`[PERMIT SYNC] Starting permit lead synchronization at ${new Date().toISOString()}`);
    const truckOutreach = await runTruckOutreachBatch();
    const creditRefill = await processCreditAutoRefill().catch((err) => {
      console.error("[PERMIT SYNC] Credit auto-refill failed:", err);
      return { ok: false, refilled: 0 };
    });

    // Get automation settings
    const settings = await getPermitAutomationSettings();

    if (!settings.enabled) {
      console.log("[PERMIT SYNC] Automation disabled");
      return new Response(
        JSON.stringify({
          ok: true,
          message: "Automation disabled",
          synced: 0,
          created: 0,
          truckOutreach,
          creditRefill,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const archiveBefore = new Date(Date.now() - settings.archiveDays * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("permit_leads")
      .update({ archived_at: new Date().toISOString(), archive_reason: `No conversion after ${settings.archiveDays} days` })
      .in("permit_status", ["new", "qualified"])
      .is("archived_at", null)
      .lt("created_at", archiveBefore);

    // Fetch new permits from scraping source (all available, not just 'new' status)
    console.log("[PERMIT SYNC] Fetching permits from scraping source...");
    const permits = await getPermitLeads(1000, true);
    console.log(`[PERMIT SYNC] Found ${permits.length} permits from source`);

    // Get existing permits in permit_leads (excluding archived)
    const { data: existingLeads } = await supabaseAdmin
      .from('permit_leads')
      .select("owner_email, owner_phone, permit_number")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    const existingEmails = new Set(
      (existingLeads || [])
        .map((l: any) => l.owner_email?.toLowerCase())
        .filter((e: any) => e)
    );
    const existingPhones = new Set(
      (existingLeads || [])
        .map((l: any) => l.owner_phone?.toLowerCase())
        .filter((e: any) => e)
    );
    const existingPermits = new Set(
      (existingLeads || [])
        .map((l: any) => l.permit_number?.toLowerCase())
        .filter((p: any) => p)
    );

    // Filter and transform new permits
    const toInsert = permits
      .filter((permit) => {
        // Spoljašnji pipeline za permite bez pravog vlasničkog kontakta ubacuje
        // izmišljenu "permit-<broj>@permit.local" adresu samo da bi zadovoljio
        // svoju šemu — to NIJE pravi email (.local se ne razrešava na internetu,
        // svaki pokušaj slanja bi tvrdo bounce-ovao). Tretiramo ga kao da nema
        // email uopšte, pa ovakav permit ulazi u permit_leads SAMO ako ima
        // pravi telefon; u suprotnom ga preskačemo (isto kao da nema kontakt).
        const hasRealEmail = !!permit.owner_email && !permit.owner_email.toLowerCase().endsWith("@permit.local");
        if (!hasRealEmail && !permit.owner_phone) {
          return false;
        }

        // Check territory filter
        if (settings.allowedTerritories.length > 0) {
          const allowed = settings.allowedTerritories.some((territory) => {
            const normalizedTerritory = territory.toLowerCase();
            const normalizedJurisdiction =
              (permit.jurisdiction || "").toLowerCase();
            return (
              normalizedJurisdiction.includes(normalizedTerritory) ||
              normalizedTerritory.includes(normalizedJurisdiction)
            );
          });
          if (!allowed) return false;
        }

        // Check score threshold
        if ((permit.lead_score || 0) < settings.minScore) {
          return false;
        }

        // Check if duplicate by email, phone, or permit number
        const isDuplicate =
          (permit.owner_email &&
            existingEmails.has(permit.owner_email.toLowerCase())) ||
          (permit.owner_phone &&
            existingPhones.has(permit.owner_phone.toLowerCase())) ||
          (permit.permit_number &&
            existingPermits.has(permit.permit_number.toLowerCase()));

        return !isDuplicate;
      })
      .map((permit) => {
        const hasRealEmail = !!permit.owner_email && !permit.owner_email.toLowerCase().endsWith("@permit.local");
        return {
          owner_name: permit.owner_name || null,
          owner_email: hasRealEmail ? permit.owner_email : null,
          owner_phone: permit.owner_phone || null,
          owner_mailing_address: permit.owner_mailing_address || null,
          permit_type: permit.permit_type || null,
          address: permit.address || null,
          jurisdiction: permit.jurisdiction || null,
          permit_description: permit.permit_description || null,
          permit_date: permit.permit_date || null,
          permit_number: permit.permit_number || null,
          lead_score: permit.lead_score || 0,
          source_name: permit.source_name || "scraped",
          source_url: permit.source_url || null,
          discovered_at: permit.discovered_at || new Date().toISOString(),
          permit_status: settings.autoApprove ? "qualified" : "new",
          assigned_to: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

    console.log(
      `[PERMIT SYNC] Ready to insert ${toInsert.length} new permits (${permits.length - toInsert.length} duplicates)`
    );

    let inserted: any[] = [];
    if (toInsert.length > 0) {
      const { error: insertError, data } = await supabaseAdmin
        .from('permit_leads')
        .insert(toInsert)
        .select();
      if (insertError) {
        console.error("[PERMIT SYNC] Insert failed:", insertError);
        throw insertError;
      }
      inserted = data || [];
    }

    // Log activity
    const insertedCount = inserted?.length || 0;
    let sentCount = 0;
    console.log(
      `[PERMIT SYNC] Successfully inserted ${insertedCount} permits`
    );

    // Create activity log entries
    if (insertedCount > 0) {
      const logs = inserted.map((permit: any) => ({
        permit_lead_id: permit.id,
        action: `Permit lead scraped from ${permit.jurisdiction || "unknown territory"}`,
        changed_by: "permit_scraper",
        created_at: new Date().toISOString(),
      }));

      await supabaseAdmin.from('permit_lead_logs').insert(logs);
    }

    if (settings.autoSend) {
        const baseUrl = import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321";
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { count: sentToday } = await supabaseAdmin.from("permit_outreach_events")
          .select("id", { count: "exact", head: true })
          .gte("sent_at", startOfDay.toISOString())
          .in("status", ["sent", "delivered", "opened", "clicked", "converted"]);
        let remainingDaily = Math.max(0, settings.permitDailyEmailLimit - Number(sentToday || 0));
        const { data: outreachQueue } = await supabaseAdmin
          .from("permit_leads")
          .select("*")
          .in("permit_status", ["new", "qualified", "invited"])
          .not("owner_email", "is", null)
          .not("owner_email", "like", "%@permit.local")
          .lt("outreach_attempts", settings.permitMaxEmailAttempts)
          .is("archived_at", null)
          // Prvo krug: svima po jedan pokušaj (najstariji permit prvo) PRE
          // nego što se iko vrati na 2. ili 3. pokušaj — outreach_attempts
          // je primarni ključ sortiranja, permit_date sekundarni.
          .order("outreach_attempts", { ascending: true })
          .order("permit_date", { ascending: true, nullsFirst: false })
          .limit(500);
        const { data: outreachHistory } = await supabaseAdmin.from("permit_outreach_events")
          .select("permit_lead_id,email,status,sent_at,created_at")
          .order("created_at", { ascending: false }).limit(5000);
        for (const permit of outreachQueue || []) {
          if (remainingDaily <= 0) break;
          if (!permit.owner_email || !permit.outreach_token) continue;
          const normalizedEmail = String(permit.owner_email).trim().toLowerCase();
          const emailHistory = (outreachHistory || []).filter((row: any) => String(row.email).toLowerCase() === normalizedEmail);
          if (emailHistory.some((row: any) => ["bounced", "complained", "unsubscribed"].includes(row.status))) continue;
          const permitHistory = (outreachHistory || []).filter((row: any) => row.permit_lead_id === permit.id);
          const lastSent = permitHistory.find((row: any) => row.sent_at);
          if (lastSent && Date.now() - new Date(lastSent.sent_at).getTime() < settings.permitEmailCooldownDays * 86400000) continue;
          const { data: event, error: eventError } = await supabaseAdmin.from("permit_outreach_events")
            .insert([{ permit_lead_id: permit.id, email: normalizedEmail, status: "queued" }]).select().single();
          if (eventError || !event) continue;
          const outreachUrl = new URL("/api/permit-click", baseUrl);
          outreachUrl.searchParams.set("token", permit.outreach_token);
          outreachUrl.searchParams.set("event", event.tracking_token);
          const openUrl = new URL("/api/permit-outreach/open", baseUrl);
          openUrl.searchParams.set("token", event.tracking_token);
          const unsubscribeUrl = new URL("/api/permit-outreach/unsubscribe", baseUrl);
          unsubscribeUrl.searchParams.set("token", event.tracking_token);
          const details = [permit.permit_type, permit.address, permit.permit_description, permit.permit_number ? `Permit ${permit.permit_number}` : null].filter(Boolean).join(" • ");
          const message = buildPermitOutreachEmail({
            fullName: permit.owner_name || "there",
            permitDetails: details,
            siteUrl: outreachUrl.toString(),
            settings,
          });
          const trackedHtml = `${message.html}<p style="font:11px Arial;color:#94a3b8;margin-top:24px">This is a one-to-one notice about public permit information. <a href="${unsubscribeUrl}">Do not contact me again</a>.</p><img src="${openUrl}" width="1" height="1" alt="" style="display:none">`;
          const sent: any = await sendEmail({
            to: permit.owner_email, subject: message.subject, html: trackedHtml,
            headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
            tags: [{ name: "category", value: "permit-outreach" }],
          });
          if (sent.ok) {
            sentCount += 1;
            remainingDaily -= 1;
            const sentAt = new Date().toISOString();
            await supabaseAdmin.from("permit_outreach_events").update({
              status: "sent", sent_at: sentAt, resend_email_id: sent.data?.id || null, updated_at: sentAt,
            }).eq("id", event.id);
            await supabaseAdmin.from("permit_leads").update({
              permit_status: "invited",
              outreach_sent_at: sentAt,
              outreach_attempts: Number(permit.outreach_attempts || 0) + 1,
              outreach_last_error: null,
            }).eq("id", permit.id);
            await supabaseAdmin.from("permit_lead_logs").insert([{
              permit_lead_id: permit.id,
              action: `Automated outreach email sent to ${permit.owner_email}`,
              changed_by: "permit_automation",
              created_at: sentAt,
            }]);
          } else {
            await supabaseAdmin.from("permit_outreach_events").update({
              status: "failed", error_message: String(sent.error || "Email delivery failed").slice(0, 1000), updated_at: new Date().toISOString(),
            }).eq("id", event.id);
            await supabaseAdmin.from("permit_leads").update({
              outreach_attempts: Number(permit.outreach_attempts || 0) + 1,
              outreach_last_error: String(sent.error || "Email delivery failed"),
            }).eq("id", permit.id);
            await supabaseAdmin.from("permit_lead_logs").insert([{
              permit_lead_id: permit.id,
              action: `Automated outreach failed: ${String(sent.error || "Unknown error")}`,
              changed_by: "permit_automation",
            }]);
          }
        }
    }

    const auditEntry = {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: insertedCount > 0 ? "success" as const : "skipped" as const,
      processed: permits.length,
      created: insertedCount,
      skipped: permits.length - insertedCount,
      sent: sentCount,
      details: `${insertedCount} opportunities created, ${permits.length - insertedCount} skipped, ${sentCount} outreach emails sent`,
      territoryFilter: settings.allowedTerritories,
    };
    await savePermitAutomationSettings({ ...settings, audit: [auditEntry, ...(settings.audit || []).slice(0, 19)] });

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Synced ${insertedCount} new permits`,
        synced: insertedCount,
        created: insertedCount,
        skipped: permits.length - insertedCount,
        truckOutreach,
        creditRefill,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[PERMIT SYNC] Sync failed:", error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error?.message || "Sync failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Use POST to trigger permit sync",
      instructions: "curl -X POST http://localhost:4321/api/permit-sync",
    }),
    { status: 405, headers: { "Content-Type": "application/json" } }
  );
}
