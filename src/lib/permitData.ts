import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";

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

export type PermitAutomationSettings = {
  enabled: boolean;
  autoSend: boolean;
  minScore: number;
  autoApprove: boolean;
  frontendAutoPublish: boolean;
  externalAutoPublish: boolean;
  externalAutoPublishDomains: string[];
  externalMinQualityScore: number;
  notifyContractorsOnPublish: boolean;
  notifyTruckOwnersOnPublish: boolean;
  permitManualPublishRequiresConfirmation: boolean;
  permitMaxEmailAttempts: number;
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
  frontendAutoPublish: true,
  externalAutoPublish: false,
  externalAutoPublishDomains: [],
  externalMinQualityScore: 70,
  notifyContractorsOnPublish: true,
  notifyTruckOwnersOnPublish: true,
  permitManualPublishRequiresConfirmation: true,
  permitMaxEmailAttempts: 3,
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
      frontendAutoPublish: parsed.frontendAutoPublish ?? DEFAULT_SETTINGS.frontendAutoPublish,
      externalAutoPublish: parsed.externalAutoPublish ?? DEFAULT_SETTINGS.externalAutoPublish,
      externalAutoPublishDomains: Array.isArray(parsed.externalAutoPublishDomains) ? parsed.externalAutoPublishDomains : DEFAULT_SETTINGS.externalAutoPublishDomains,
      externalMinQualityScore: Number(parsed.externalMinQualityScore ?? DEFAULT_SETTINGS.externalMinQualityScore),
      notifyContractorsOnPublish: parsed.notifyContractorsOnPublish ?? DEFAULT_SETTINGS.notifyContractorsOnPublish,
      notifyTruckOwnersOnPublish: parsed.notifyTruckOwnersOnPublish ?? DEFAULT_SETTINGS.notifyTruckOwnersOnPublish,
      permitManualPublishRequiresConfirmation: parsed.permitManualPublishRequiresConfirmation ?? DEFAULT_SETTINGS.permitManualPublishRequiresConfirmation,
      permitMaxEmailAttempts: Number(parsed.permitMaxEmailAttempts ?? DEFAULT_SETTINGS.permitMaxEmailAttempts),
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
