import { supabaseAdmin } from "./supabaseAdmin";
import { getPermitAutomationSettings } from "./permitData";
import { runNotify } from "../pages/api/notify-new-lead";

export type PublishOrigin = "website" | "external" | "permit_dispatch";

export type PublishLeadInput = {
  originType: PublishOrigin;
  originId?: string | null;
  county: string;
  email?: string | null;
  phone?: string | null;
  details?: string | null;
  source?: string | null;
  siteUrl: string;
  customerSubmitted?: boolean;
  makeAvailable?: boolean;
  attribution?: Record<string, string | null> | null;
};

function normalizeEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

export function scoreExternalLead(lead: any) {
  let score = 0;
  if (normalizeEmail(lead?.email)) score += 30;
  if (normalizePhone(lead?.phone).length >= 10) score += 30;
  if (String(lead?.full_name || "").trim().length >= 3) score += 15;
  if (String(lead?.message || "").trim().length >= 20) score += 15;
  if (lead?.sms_consent) score += 5;
  if (String(lead?.source_domain || "").trim()) score += 5;
  return Math.min(score, 100);
}

export async function publishWebsiteLead(input: PublishLeadInput) {
  if (!supabaseAdmin) throw new Error("Service role is not configured");

  const county = String(input.county || "").trim();
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!county) throw new Error("Territory is required");
  if (!email && !phone) throw new Error("Email or phone is required");

  if (input.originId) {
    const { data: existingOrigin } = await supabaseAdmin
      .from("leads")
      .select("id,status")
      .eq("origin_type", input.originType)
      .eq("origin_id", input.originId)
      .maybeSingle();
    if (existingOrigin) return { lead: existingOrigin, created: false, duplicate: "origin" };
  }

  let duplicateQuery = supabaseAdmin
    .from("leads")
    .select("id,status,email,phone")
    .in("status", ["new", "approved", "claimed"])
    .limit(20);
  if (email) duplicateQuery = duplicateQuery.eq("email", email);
  else duplicateQuery = duplicateQuery.eq("phone", input.phone);
  const { data: contactMatches } = await duplicateQuery;
  const duplicate = (contactMatches || []).find((row: any) =>
    (email && normalizeEmail(row.email) === email) ||
    (phone && normalizePhone(row.phone) === phone)
  );
  if (duplicate) return { lead: duplicate, created: false, duplicate: "contact" };

  const now = new Date().toISOString();
  const makeAvailable = input.makeAvailable !== false;
  const { data: lead, error } = await supabaseAdmin.from("leads").insert([{
    county,
    email: email || null,
    phone: input.phone || null,
    details: input.details || null,
    status: makeAvailable ? "approved" : "new",
    source: input.source || (input.originType === "website" ? "website" : input.originType),
    origin_type: input.originType,
    origin_id: input.originId || null,
    consent_status: input.customerSubmitted === false ? "unconfirmed_dispatch" : "customer_submitted",
    published_at: makeAvailable ? now : null,
    created_at: now,
    extra: input.attribution ? { attribution: input.attribution } : null,
  }]).select().single();
  if (error) throw error;

  await supabaseAdmin.from("lead_logs").insert([{
    lead_id: lead.id,
    action: `Published to Website Leads from ${input.originType}`,
    changed_by: input.originType === "website" ? "website_form" : "dispatch_workflow",
  }]);

  const settings = await getPermitAutomationSettings();
  let notification: any = null;
  if (makeAvailable && (settings.notifyContractorsOnPublish || settings.notifyTruckOwnersOnPublish)) {
    notification = await runNotify(county, input.details || "", input.siteUrl, {
      notifyContractors: settings.notifyContractorsOnPublish,
      notifyTruckOwners: settings.notifyTruckOwnersOnPublish,
    });
    const contractorCount = notification.body?.contractors_matched_active_with_email || 0;
    const truckOwnerCount = notification.body?.truck_owners_matched_approved_with_email || 0;
    await supabaseAdmin.from("lead_logs").insert([{
      lead_id: lead.id,
      action: `Availability notification sent to ${contractorCount} contractors and ${truckOwnerCount} truck owners`,
      changed_by: "lead_publisher",
    }]);
  }

  return { lead, created: true, notification };
}
