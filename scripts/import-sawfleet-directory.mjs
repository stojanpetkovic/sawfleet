/**
 * SawFleet public directory importer (no images).
 *
 * Required:
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   SAWFLEET_COOKIE   Browser Cookie header when the source's Cloudflare
 *                     protection requires an authenticated/verified session.
 *
 * Run:
 *   node scripts/import-sawfleet-directory.mjs
 *
 * The importer is idempotent via source_key and never creates auth users,
 * truck_owners, approved trucks, lead eligibility or notifications.
 */

const sourceOrigin = "https://sawfleet.com";
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cookie = process.env.SAWFLEET_COOKIE || "";

if (!supabaseUrl || !serviceKey) {
  throw new Error("PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const headers = {
  "User-Agent": "SF-Tree-Removal-Directory-Importer/1.0 (+https://sftreeremoval.com/)",
  Accept: "text/html,application/xhtml+xml,application/xml",
  ...(cookie ? { Cookie: cookie } : {}),
};

const clean = (value) => String(value || "")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#8217;|&rsquo;/g, "’")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const numberAfter = (text, labels) => {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*:?\\s*(\\d+(?:\\.\\d+)?)`, "i"));
    if (match) return Number(match[1]);
  }
  return null;
};

async function fetchText(url) {
  const response = await fetch(url, { headers, redirect: "follow" });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  if (/Just a moment|cf-chl-|challenge-platform/i.test(body)) {
    throw new Error(`Cloudflare challenge at ${url}. Supply SAWFLEET_COOKIE from an authorized browser session.`);
  }
  return body;
}

async function discoverUrls() {
  const index = await fetchText(`${sourceOrigin}/sitemap_index.xml`);
  const sitemapUrls = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const pages = [];
  for (const sitemapUrl of sitemapUrls) {
    const sitemap = await fetchText(sitemapUrl);
    pages.push(...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  }
  return [...new Set(pages)].filter((url) => /\/(equipment|our-fleet)\//i.test(url));
}

function parseProfile(url, html) {
  const text = clean(html);
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop();
  const title = clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || slug);
  const company =
    text.match(/Contact Information\s+(.+?)\s+[A-Z][a-zA-Z .'-]+,\s*[A-Z]{2}\b/i)?.[1] ||
    text.match(/For Hire at:\s*(.+?)(?:\s+\d+(?:\.\d+)?t|\s+[A-Z][a-z]+,\s*[A-Z]{2})/i)?.[1] ||
    title.split("|").at(-2)?.trim() ||
    title;
  const location = text.match(/(?:Location \(City, State\)|Contact Information)\s*:?\s*(?:.+?\s+)?([A-Za-z .'-]+),\s*([A-Z]{2})\b/i);
  const contact = text.match(/Contact Information\s+.+?\s+[A-Za-z .'-]+,\s*[A-Z]{2}\s+([A-Za-z .'-]+?)\s+(?:Contact Operator|Quick Info)/i)?.[1];
  const description = text.match(/About This Operator\s+(.+?)(?:Storm Response Zone|Contact Information|Quick Info)/i)?.[1] || null;

  return {
    slug,
    company_name: clean(company),
    contact_name: contact ? clean(contact) : null,
    equipment_name: title.split("|")[0].trim(),
    lift_capacity_tons: numberAfter(text, ["Lift Capacity"]),
    working_height_ft: numberAfter(text, ["Working Height", "Max reach"]),
    location_city: location?.[1]?.trim() || null,
    location_state: location?.[2] || null,
    service_radius_miles: numberAfter(text, ["Service Radius", "Service radius"]),
    storm_radius_miles: numberAfter(text, ["Storm Response Radius", "Storm Radius"]),
    access_notes: text.match(/Access\s*:?\s*(.+?)(?:Service Radius|Storm|Insured|Listing Type|About)/i)?.[1]?.trim() || null,
    availability_notes: text.match(/Availability\s*:?\s*(.+?)(?:Access|About|Contact|Quick Info)/i)?.[1]?.trim() || null,
    rate_notes: text.match(/Rates?\s*:?\s*(.+?)(?:Availability|Access|Insurance|About)/i)?.[1]?.trim() || null,
    insurance_claim: text.match(/Insur(?:ed|ance)\s*:?\s*(Yes|No|Fully insured)/i)?.[1] || null,
    operator_experience: text.match(/(?:Op\. Experience|Operator)\s*:?\s*(.+?)(?:Safety First|Rates|Availability|Access)/i)?.[1]?.trim() || null,
    description,
    source_name: "SawFleet",
    source_url: url,
    source_key: `sawfleet:${slug}`,
    source_payload: { scraped_text: text.slice(0, 12000) },
    profile_status: "unclaimed",
    verification_status: "unverified",
    is_published: true,
    last_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsert(rows) {
  const response = await fetch(`${supabaseUrl}/rest/v1/unclaimed_truck_directory?on_conflict=source_key`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Supabase import failed: ${response.status} ${await response.text()}`);
  return response.json();
}

const urls = await discoverUrls();
const profiles = [];
for (const url of urls) {
  const html = await fetchText(url);
  profiles.push(parseProfile(url, html));
}

if (!profiles.length) throw new Error("No SawFleet equipment profiles discovered");
const imported = await upsert(profiles);
process.stdout.write(`Imported or updated ${imported.length} unclaimed truck profiles (no images).\n`);
