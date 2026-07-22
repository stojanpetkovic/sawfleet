import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";
import { sendEmail } from "./resend";

type PermitLead = {
  id: string;
  source_name: string | null;
  jurisdiction: string | null;
  address: string | null;
  permit_type: string | null;
  permit_description: string | null;
  permit_date: string | null;
  permit_number: string | null;
  lead_score: number | null;
  source_url: string | null;
  discovered_at: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  owner_mailing_address: string | null;
  raw_payload_json?: string | null;
};

type PermitRunAuditEntry = {
  id: string;
  timestamp: string;
  status: "success" | "failed" | "skipped";
  processed: number;
  created: number;
  skipped: number;
  sent: number;
  details: string;
  territoryFilter: string[];
};

type PermitAutomationSettings = {
  enabled: boolean;
  autoSend: boolean;
  minScore: number;
  autoApprove: boolean;
  emailSubject: string;
  emailTemplate: string;
  allowedTerritories: string[];
  archiveDays: number;
  audit: PermitRunAuditEntry[];
};

const DEFAULT_SUPABASE_URL = "https://tjzpqyfjtjepvguywzgn.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqenBxeWZqdGplcHZndXl3emduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzgyMjQsImV4cCI6MjA5MDg1NDIyNH0.H42xFcUVYoyIHqFd1OskGBWi4OHdvClZ0EMr566FJrI";

const DEFAULT_SETTINGS: PermitAutomationSettings = {
  enabled: true,
  autoSend: false,
  minScore: 0,
  autoApprove: false,
  emailSubject: "We can help with your permit project",
  emailTemplate: `<!doctype html><html><body><div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;border:1px solid #e5e7eb;border-radius:16px;margin:0 auto;"><p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#16803C;font-weight:bold;">// Permit outreach</p><h1 style="font-size:24px;margin:12px 0;">We can help with your permit project</h1><p style="color:#475569;line-height:1.6;">Hi {{fullName}}, we noticed a recent permit opportunity that may be relevant to your project.</p><p style="color:#64748b;line-height:1.6;border-left:2px solid #e2e8f0;padding-left:12px;">{{permitDetails}}</p><p style="margin-top:16px;"><a href="{{siteUrl}}" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;">View our service options →</a></p></div></body></html>`,
  allowedTerritories: [],
  archiveDays: 60,
  audit: [],
};

function normalizePermitLead(raw: any): PermitLead {
  return {
    id: raw?.id || raw?.permit_number || `${raw?.source_name || "permit"}-${raw?.permit_number || Date.now()}`,
    source_name: raw?.source_name || null,
    jurisdiction: raw?.jurisdiction || null,
    address: raw?.address || null,
    permit_type: raw?.permit_type || null,
    permit_description: raw?.permit_description || null,
    permit_date: raw?.permit_date || null,
    permit_number: raw?.permit_number || null,
    lead_score: raw?.lead_score ?? null,
    source_url: raw?.source_url || null,
    discovered_at: raw?.discovered_at || null,
    owner_name: raw?.owner_name || null,
    owner_email: raw?.owner_email || null,
    owner_phone: raw?.owner_phone || null,
    owner_mailing_address: raw?.owner_mailing_address || null,
    raw_payload_json: raw?.raw_payload_json || null,
  };
}

export function parsePermitSettings(raw: string | null | undefined): PermitAutomationSettings {
  if (!raw) return DEFAULT_SETTINGS;
  const marker = /<!--\s*PERMIT_SETTINGS_JSON:(.*?)\s*-->/s;
  const match = raw.match(marker);
  if (!match?.[1]) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(match[1]);
    return {
      enabled: parsed.enabled ?? DEFAULT_SETTINGS.enabled,
      autoSend: parsed.autoSend ?? DEFAULT_SETTINGS.autoSend,
      minScore: Number(parsed.minScore ?? DEFAULT_SETTINGS.minScore),
      autoApprove: parsed.autoApprove ?? DEFAULT_SETTINGS.autoApprove,
      emailSubject: parsed.emailSubject || DEFAULT_SETTINGS.emailSubject,
      emailTemplate: parsed.emailTemplate || DEFAULT_SETTINGS.emailTemplate,
      archiveDays: Number(parsed.archiveDays ?? DEFAULT_SETTINGS.archiveDays),
      allowedTerritories: Array.isArray(parsed.allowedTerritories) ? parsed.allowedTerritories : DEFAULT_SETTINGS.allowedTerritories,
      audit: Array.isArray(parsed.audit) ? parsed.audit : DEFAULT_SETTINGS.audit,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function buildPermitSettingsComment(settings: PermitAutomationSettings) {
  return `<!-- PERMIT_SETTINGS_JSON:${JSON.stringify(settings)} -->`;
}

function stripPermitSettingsComment(raw: string | null | undefined) {
  return (raw || "").replace(/<!--\s*PERMIT_SETTINGS_JSON:.*?\s*-->/s, "").trim();
}

function derivePermitLeadStatus(row: any, logs: any[] = []) {
  const normalizedStatus = String(row?.status || "").toLowerCase();
  const combinedLogText = (logs || []).map((log) => String(log?.action || "").toLowerCase()).join(" ");

  if (normalizedStatus.includes("converted") || combinedLogText.includes("converted")) {
    return "converted";
  }

  if (normalizedStatus.includes("responded") || combinedLogText.includes("responded") || combinedLogText.includes("response")) {
    return "responded";
  }

  if (normalizedStatus.includes("invited") || combinedLogText.includes("invited") || combinedLogText.includes("outreach") || combinedLogText.includes("email sent") || combinedLogText.includes("invite")) {
    return "invited";
  }

  return normalizedStatus === "approved" ? "invited" : "new";
}

export async function getPermitAutomationSettings(): Promise<PermitAutomationSettings> {
  const db = supabaseAdmin ?? supabase;
  const { data } = await db.from("tracking_settings").select("global_scripts").eq("id", 1).maybeSingle();
  return parsePermitSettings(data?.global_scripts);
}

export async function savePermitAutomationSettings(settings: PermitAutomationSettings) {
  const db = supabaseAdmin ?? supabase;
  const { data: current } = await db.from("tracking_settings").select("global_scripts").eq("id", 1).maybeSingle();
  const currentScripts = current?.global_scripts || "";
  const nextScripts = `${buildPermitSettingsComment(settings)}\n${stripPermitSettingsComment(currentScripts)}`.trim();
  return db.from("tracking_settings").upsert({ id: 1, global_scripts: nextScripts });
}

export function buildPermitOutreachEmail({ fullName, permitDetails, siteUrl, settings }: { fullName: string; permitDetails: string; siteUrl: string; settings?: PermitAutomationSettings }) {
  const resolved = settings || DEFAULT_SETTINGS;
  const subject = resolved.emailSubject || DEFAULT_SETTINGS.emailSubject;
  const template = resolved.emailTemplate || DEFAULT_SETTINGS.emailTemplate;
  const html = template
    .replace(/\{\{fullName\}\}/g, fullName || "there")
    .replace(/\{\{permitDetails\}\}/g, permitDetails || "We can review the opportunity and help you move forward.")
    .replace(/\{\{siteUrl\}\}/g, siteUrl)
    .replace(/\{\{subject\}\}/g, subject);
  return { subject, html };
}

export async function getPermitLeads(limit = 500, includeAllStatuses = true): Promise<PermitLead[]> {
  const supabaseUrl = import.meta.env.PUBLIC_PERMIT_DASHBOARD_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = import.meta.env.PUBLIC_PERMIT_DASHBOARD_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const params = new URLSearchParams({
    select: "id,source_name,jurisdiction,address,permit_type,permit_description,permit_date,permit_number,lead_score,source_url,discovered_at,owner_name,owner_email,owner_phone,owner_mailing_address,raw_payload_json",
    lead_type: "eq.permit",
    order: "discovered_at.desc",
    limit: String(limit),
  });
  
  if (!includeAllStatuses) {
    params.append("lead_status", "eq.new");
  }

  const url = `${supabaseUrl}/rest/v1/leads?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Permit fetch failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return (Array.isArray(payload) ? payload : []).map(normalizePermitLead);
}

export async function syncPermitLeads(limit = 100, options: { sendOutreach?: boolean; siteUrl?: string } = {}) {
  const db = supabaseAdmin ?? supabase;
  const settings = await getPermitAutomationSettings();
  const permits = await getPermitLeads(limit);

  if (!settings.enabled) {
    return { created: [], leads: [], debug: [{ action: "Automation disabled", status: "skipped", details: "Permit automation is disabled in settings", permit_number: "" }], audit: settings.audit };
  }

  const { data: existingRows } = await db.from("leads").select("*").eq("source", "permit_automation").order("created_at", { ascending: false }).limit(250);
  const existingLeadRows = existingRows || [];
  const created: any[] = [];
  const debug: any[] = [];
  let processed = 0;
  let skipped = 0;
  let sent = 0;

  for (const permit of permits) {
    processed += 1;
    const email = permit.owner_email?.trim() || "";
    const phone = permit.owner_phone?.trim() || "";
    const name = permit.owner_name?.trim() || "";
    const jurisdiction = permit.jurisdiction || "";
    const permitNumber = permit.permit_number || "";
    const leadScore = Number(permit.lead_score ?? 0);

    const isTerritoryAllowed = settings.allowedTerritories.length === 0 || settings.allowedTerritories.some((territory) => {
      const normalizedTerritory = territory.toLowerCase();
      const normalizedJurisdiction = jurisdiction.toLowerCase();
      return normalizedJurisdiction.includes(normalizedTerritory) || normalizedTerritory.includes(normalizedJurisdiction);
    });

    if (!isTerritoryAllowed) {
      skipped += 1;
      debug.push({ permit_number: permitNumber, action: "Outside selected territories", status: "skipped", details: `Territory ${jurisdiction || "unknown"} is not selected` });
      continue;
    }

    if (leadScore < settings.minScore) {
      skipped += 1;
      debug.push({ permit_number: permitNumber, action: "Permit score below threshold", status: "skipped", details: `Permit score ${leadScore} < ${settings.minScore}` });
      continue;
    }

    if (!email && !phone) {
      skipped += 1;
      debug.push({ permit_number: permitNumber, action: "Missing contact", status: "skipped", details: "No email or phone available" });
      continue;
    }

    const isDuplicate = existingLeadRows.some((row: any) => {
      const detailsText = String(row.details || "");
      const rowEmail = String(row.email || "");
      const rowPhone = String(row.phone || "");
      return Boolean(
        (email && rowEmail && rowEmail === email) ||
        (phone && rowPhone && rowPhone === phone) ||
        (permitNumber && detailsText.includes(permitNumber))
      );
    });

    if (isDuplicate) {
      skipped += 1;
      debug.push({ permit_number: permitNumber, action: "Duplicate lead", status: "skipped", details: "Lead already exists" });
      continue;
    }

    const details = [permit.permit_type || "Permit", permit.address || "", permit.permit_description || "", permitNumber ? `Permit ${permitNumber}` : ""].filter(Boolean).join(" • ");
    const leadStatus = settings.autoApprove ? "approved" : "new";

    const { data: inserted, error } = await db.from("leads").insert([{
      email,
      phone,
      county: jurisdiction,
      details,
      status: leadStatus,
      source: "permit_automation",
      created_at: new Date().toISOString(),
    }]).select().single();

    if (error) {
      console.error("permit lead insert failed", error);
      debug.push({ permit_number: permitNumber, action: "Insert failed", status: "failed", details: error.message });
      continue;
    }

    await db.from("lead_logs").insert([{
      lead_id: inserted.id,
      action: `Permit lead created from ${jurisdiction || "permit feed"}${settings.autoApprove ? " and auto-approved" : ""}`,
      changed_by: "permit_automation",
    }]);

    if (options.sendOutreach && settings.autoSend && email) {
      const siteUrl = options.siteUrl || import.meta.env.PUBLIC_SITE_URL || "https://sawfleet2026-eng.github.io/Tree-Permit-Lead-Dashboard/";
      const outreachUrl = new URL(siteUrl);
      outreachUrl.searchParams.set("utm_source", "permit_outreach");
      outreachUrl.searchParams.set("utm_medium", "email");
      outreachUrl.searchParams.set("permit_number", permitNumber || "");
      outreachUrl.searchParams.set("permit_type", permit.permit_type || "");
      outreachUrl.searchParams.set("permit_address", permit.address || "");

      const { subject, html } = buildPermitOutreachEmail({
        fullName: name || "there",
        permitDetails: details,
        siteUrl: outreachUrl.toString(),
        settings,
      });

      const mailResult = await sendEmail({
        to: email,
        subject,
        html,
      });

      if (mailResult.ok) {
        sent += 1;
        await db.from("lead_logs").insert([{
          lead_id: inserted.id,
          action: `Permit outreach email sent to ${email}`,
          changed_by: "permit_automation",
        }]);
        debug.push({ permit_number: permitNumber, action: "Insert succeeded and email sent", status: "success", details: `Created lead ${inserted.id}` });
      } else {
        debug.push({ permit_number: permitNumber, action: "Insert succeeded but email failed", status: "failed", details: mailResult.error });
      }
    } else {
      debug.push({ permit_number: permitNumber, action: "Insert succeeded", status: "success", details: `Created lead ${inserted.id}` });
    }

    created.push({
      id: inserted.id,
      email,
      phone,
      county: jurisdiction,
      details,
      status: leadStatus,
      source: "permit_automation",
      created_at: inserted.created_at,
      permit_number: permitNumber,
      permit_type: permit.permit_type,
      address: permit.address,
      jurisdiction,
      permit_description: permit.permit_description,
      permit_date: permit.permit_date,
      source_url: permit.source_url,
      lead_score: permit.lead_score,
      owner_name: name,
    });
  }

  const nextAuditEntry: PermitRunAuditEntry = {
    id: `${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: created.length > 0 ? "success" : "skipped",
    processed,
    created: created.length,
    skipped,
    sent,
    details: `${created.length} created, ${skipped} skipped, ${sent} emails sent`,
    territoryFilter: settings.allowedTerritories,
  };

  const nextAudit = [nextAuditEntry, ...(settings.audit || []).slice(0, 19)];
  await savePermitAutomationSettings({ ...settings, audit: nextAudit });

  const { data: leadRows } = await db.from("leads").select("*").eq("source", "permit_automation").order("created_at", { ascending: false });
  const leadIds = (leadRows || []).map((row: any) => row.id).filter(Boolean);
  let logsByLeadId: Record<string, any[]> = {};

  if (leadIds.length) {
    const { data: leadLogs } = await db.from("lead_logs").select("*").in("lead_id", leadIds).order("created_at", { ascending: false });
    for (const log of leadLogs || []) {
      const existing = logsByLeadId[log.lead_id] || [];
      existing.push(log);
      logsByLeadId[log.lead_id] = existing;
    }
  }

  return {
    created,
    leads: (leadRows || [])
      .filter((row: any) => String(row?.email || "").trim())
      .map((row: any) => {
        const history = (logsByLeadId[row.id] || []).slice(0, 6);
        return {
          ...row,
          permit_status: derivePermitLeadStatus(row, history),
          activity: history.map((log: any) => ({
            action: log.action,
            created_at: log.created_at,
            changed_by: log.changed_by,
          })),
          permit_number: row.details?.match(/Permit\s+([A-Za-z0-9-]+)/)?.[1] || null,
          permit_type: row.details?.split(" • ")[0] || null,
          address: row.details?.split(" • ")[1] || null,
          jurisdiction: row.county || null,
          permit_description: row.details || null,
        };
      }),
    debug,
    audit: nextAudit,
  };
}

export function buildPermitOutreachUrl(permit: Partial<PermitLead> | null, baseUrl: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", "permit_outreach");
  url.searchParams.set("utm_medium", "email");
  if (permit?.permit_number) url.searchParams.set("permit_number", permit.permit_number);
  if (permit?.permit_type) url.searchParams.set("permit_type", permit.permit_type);
  if (permit?.address) url.searchParams.set("permit_address", permit.address);
  if (permit?.jurisdiction) url.searchParams.set("permit_jurisdiction", permit.jurisdiction);
  if (permit?.permit_description) url.searchParams.set("permit_details", permit.permit_description);
  return url.toString();
}
