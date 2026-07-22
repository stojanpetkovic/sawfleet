import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";
import { sendEmail, permitLeadOutreachEmailHtml } from "./resend";

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

const DEFAULT_SUPABASE_URL = "https://tjzpqyfjtjepvguywzgn.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqenBxeWZqdGplcHZndXl3emduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNzgyMjQsImV4cCI6MjA5MDg1NDIyNH0.H42xFcUVYoyIHqFd1OskGBWi4OHdvClZ0EMr566FJrI";

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

export async function getPermitLeads(limit = 100): Promise<PermitLead[]> {
  const supabaseUrl = import.meta.env.PUBLIC_PERMIT_DASHBOARD_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey = import.meta.env.PUBLIC_PERMIT_DASHBOARD_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const params = new URLSearchParams({
    select: "id,source_name,jurisdiction,address,permit_type,permit_description,permit_date,permit_number,lead_score,source_url,discovered_at,owner_name,owner_email,owner_phone,owner_mailing_address,raw_payload_json",
    "lead_type=eq": "permit",
    "lead_status=eq": "new",
    order: "discovered_at.desc",
    limit: String(limit),
  });

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
  const permits = await getPermitLeads(limit);

  const { data: existingRows } = await db.from("leads").select("*").eq("source", "permit_automation").order("created_at", { ascending: false }).limit(250);
  const existingLeadRows = existingRows || [];
  const created: any[] = [];

  for (const permit of permits) {
    const email = permit.owner_email?.trim() || "";
    const phone = permit.owner_phone?.trim() || "";
    const name = permit.owner_name?.trim() || "";
    const jurisdiction = permit.jurisdiction || "";
    const permitNumber = permit.permit_number || "";

    if (!email && !phone) continue;

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

    if (isDuplicate) continue;

    const details = [permit.permit_type || "Permit", permit.address || "", permit.permit_description || "", permitNumber ? `Permit ${permitNumber}` : ""].filter(Boolean).join(" • ");

    const { data: inserted, error } = await db.from("leads").insert([{
      email,
      phone,
      county: jurisdiction,
      details,
      status: "new",
      source: "permit_automation",
      created_at: new Date().toISOString(),
    }]).select().single();

    if (error) {
      console.error("permit lead insert failed", error);
      continue;
    }

    await db.from("lead_logs").insert([{
      lead_id: inserted.id,
      action: `Permit lead created from ${jurisdiction || "permit feed"}`,
      changed_by: "permit_automation",
    }]);

    if (options.sendOutreach && email) {
      const siteUrl = options.siteUrl || import.meta.env.PUBLIC_SITE_URL || "https://sawfleet2026-eng.github.io/Tree-Permit-Lead-Dashboard/";
      const outreachUrl = new URL(siteUrl);
      outreachUrl.searchParams.set("utm_source", "permit_outreach");
      outreachUrl.searchParams.set("utm_medium", "email");
      outreachUrl.searchParams.set("permit_number", permitNumber || "");
      outreachUrl.searchParams.set("permit_type", permit.permit_type || "");
      outreachUrl.searchParams.set("permit_address", permit.address || "");

      const html = permitLeadOutreachEmailHtml({
        fullName: name || "there",
        permitDetails: details,
        siteUrl: outreachUrl.toString(),
      });

      const mailResult = await sendEmail({
        to: email,
        subject: "We can help with your permit project",
        html,
      });

      if (mailResult.ok) {
        await db.from("lead_logs").insert([{
          lead_id: inserted.id,
          action: `Permit outreach email sent to ${email}`,
          changed_by: "permit_automation",
        }]);
      }
    }

    created.push({
      id: inserted.id,
      email,
      phone,
      county: jurisdiction,
      details,
      status: "new",
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

  const { data: leadRows } = await db.from("leads").select("*").eq("source", "permit_automation").order("created_at", { ascending: false });

  return {
    created,
    leads: (leadRows || []).map((row: any) => ({
      ...row,
      permit_number: row.details?.match(/Permit\s+([A-Za-z0-9-]+)/)?.[1] || null,
      permit_type: row.details?.split(" • ")[0] || null,
      address: row.details?.split(" • ")[1] || null,
      jurisdiction: row.county || null,
      permit_description: row.details || null,
    })),
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
