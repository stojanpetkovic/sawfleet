/**
 * Imports SawFleet's public operator/equipment directory through an already
 * open Chrome session. No images are read or stored.
 *
 * Start Chrome:
 * google-chrome --user-data-dir=/tmp/sawfleet-cdp-browser \
 *   --remote-debugging-port=9222 https://sawfleet.com/operators/
 *
 * Then run:
 * npm run import:sawfleet:cdp
 */

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("Supabase environment variables are required");

const targets = await fetch("http://127.0.0.1:9222/json").then((response) => response.json());
const page = targets.find((target) => target.type === "page" && target.url.includes("/operators/"));
if (!page) throw new Error("Open https://sawfleet.com/operators/ in the CDP Chrome session first");

function evaluate(expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("Chrome evaluation timed out"));
    }, 10 * 60 * 1000);
    socket.onopen = () => socket.send(JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression, awaitPromise: true, returnByValue: true },
    }));
    socket.onerror = reject;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timeout);
      socket.close();
      if (message.exceptionDetails) reject(new Error(message.exceptionDetails.text));
      else resolve(message.result.result.value);
    };
  });
}

const browserExpression = String.raw`
(async () => {
  const text = (root, selector) => root.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim() || "";
  const valueAfter = (raw, label) => {
    const match = raw.match(new RegExp("(?:^|\\n)\\s*" + label + "\\s*:\\s*([^\\n]+)", "i"));
    return match ? match[1].trim() : null;
  };
  const numeric = (value) => {
    const match = String(value || "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  };
  const locationParts = (raw) => {
    const stateOnly = String(raw || "").trim().match(/^([A-Z]{2})(?:\s+\d{5})?$/);
    if (stateOnly) return { city: null, state: stateOnly[1] };
    const match = String(raw || "").match(/^(.*?),?\s+([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
    return { city: match?.[1]?.replace(/,$/, "").trim() || null, state: match?.[2] || null };
  };
  const slugify = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
  const runPool = async (items, worker, size = 8) => {
    const results = [];
    let cursor = 0;
    async function run() {
      while (cursor < items.length) {
        const index = cursor++;
        try { results[index] = await worker(items[index], index); }
        catch (error) { results[index] = { error: String(error), item: items[index] }; }
      }
    }
    await Promise.all(Array.from({ length: size }, run));
    return results;
  };
  const decodeCfEmail = (encoded) => {
    if (!encoded) return null;
    try {
      const key = parseInt(encoded.slice(0, 2), 16);
      let email = "";
      for (let index = 2; index < encoded.length; index += 2) {
        email += String.fromCharCode(parseInt(encoded.slice(index, index + 2), 16) ^ key);
      }
      return email;
    } catch { return null; }
  };

  const operators = [...document.querySelectorAll(".sf-fe-card.sf-op-card")].map((card) => {
    const company = text(card, ".sf-fe-card-name");
    const location = text(card, ".sf-fe-card-location span");
    const count = numeric(text(card, ".sf-fe-card-specs"));
    return {
      company,
      companyType: text(card, ".sf-op-type"),
      location,
      verification: text(card, ".sf-fe-badge"),
      equipmentCount: count || 0,
      url: card.querySelector(".sf-fe-card-btn")?.href,
    };
  }).filter((operator) =>
    operator.url && operator.equipmentCount > 0 &&
    !/^test(?:\s|$)|^6$/i.test(operator.company)
  );

  const authorResults = await runPool(operators, async (operator) => {
    const html = await fetch(operator.url).then((response) => {
      if (!response.ok) throw new Error(response.status + " " + operator.url);
      return response.text();
    });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const operatorText = doc.body.innerText;
    const emailLink = doc.querySelector('a[href^="mailto:"]');
    const protectedEmail = doc.querySelector("[data-cfemail]")?.getAttribute("data-cfemail");
    const publicEmail = emailLink?.getAttribute("href")?.replace(/^mailto:/i, "").split("?")[0] ||
      decodeCfEmail(protectedEmail);
    const publicPhone = doc.querySelector('a[href^="tel:"]')?.getAttribute("href")?.replace(/^tel:/i, "") || null;
    const publicWebsite = [...doc.querySelectorAll('a[href^="http"]')]
      .map((link) => link.href)
      .find((href) => !/sawfleet\.com|facebook\.com|instagram\.com|youtube\.com|google\.com|webdevia\.com|mybluehost\.me|wordpress\.org/i.test(href)) || null;
    const cards = [...doc.querySelectorAll(".sf-op-eq-mini-card")];
    return cards.map((card, equipmentIndex) => {
      const raw = card.innerText;
      const detailUrl = [...card.querySelectorAll("a")].find((link) => /View Details/i.test(link.innerText))?.href || operator.url;
      return {
        operator,
        equipmentIndex,
        detailUrl,
        equipmentName: valueAfter(raw, "Equipment") || operator.company + " equipment",
        capacity: numeric(valueAfter(raw, "Capacity")),
        location: valueAfter(raw, "Location") || operator.location,
        insured: valueAfter(raw, "Insured"),
        listingType: valueAfter(raw, "Listing Type") || "Rent",
        availability: /\bAvailable\b/i.test(raw) ? "Available" : null,
        operatorText: operatorText.slice(0, 12000),
        publicEmail,
        publicPhone,
        publicWebsite,
      };
    });
  });
  const equipment = authorResults.flatMap((result) => Array.isArray(result) ? result : []);

  const detailed = await runPool(equipment, async (item) => {
    let detailText = "";
    if (item.detailUrl && item.detailUrl !== item.operator.url) {
      const html = await fetch(item.detailUrl).then((response) => response.ok ? response.text() : "");
      const doc = new DOMParser().parseFromString(html, "text/html");
      detailText = (doc.querySelector(".sf-eq-page, main, article") || doc.body).innerText.replace(/\r/g, "");
    }
    const combined = detailText || item.operatorText;
    const loc = locationParts(item.location || item.operator.location);
    const sourceSlug = new URL(item.detailUrl).pathname.split("/").filter(Boolean).pop() ||
      slugify(item.operator.company + "-" + item.equipmentName + "-" + item.equipmentIndex);
    const description =
      combined.match(/About This Operator\s+([\s\S]+?)(?:Storm Response Zone|Contact Information|Quick Info)/i)?.[1]?.trim() ||
      null;
    return {
      slug: slugify(item.operator.company + "-" + item.equipmentName + "-" + sourceSlug),
      company_name: item.operator.company,
      contact_name: null,
      equipment_name: item.equipmentName,
      manufacturer: item.equipmentName.split(/\s+/)[0] || null,
      model: item.equipmentName.split(/\s+/).slice(1).join(" ") || null,
      lift_capacity_tons: numeric(valueAfter(combined, "Lift Capacity")) || item.capacity,
      working_height_ft: numeric(valueAfter(combined, "Working Height")) || numeric(valueAfter(combined, "Max reach")),
      location_city: loc.city,
      location_state: loc.state,
      service_radius_miles: numeric(valueAfter(combined, "Service Radius")),
      storm_radius_miles: numeric(valueAfter(combined, "Storm Response Radius")) || numeric(valueAfter(combined, "Storm Radius")),
      access_notes: valueAfter(combined, "Access"),
      availability_notes: valueAfter(combined, "Availability") || item.availability,
      rate_notes: valueAfter(combined, "Rates?"),
      insurance_claim: valueAfter(combined, "Insured") || valueAfter(combined, "Insurance") || item.insured,
      operator_experience: valueAfter(combined, "Op\\. Experience") || valueAfter(combined, "Operator"),
      description,
      listing_type: item.listingType,
      source_name: "SawFleet",
      source_url: item.detailUrl,
      source_key: "sawfleet:" + sourceSlug,
      source_payload: {
        operator_url: item.operator.url,
        operator_status: item.operator.verification,
        company_type: item.operator.companyType,
        source_equipment_count: item.operator.equipmentCount,
        public_email: item.publicEmail,
        public_phone: item.publicPhone,
        public_website: item.publicWebsite,
      },
      profile_status: "unclaimed",
      verification_status: "unverified",
      is_published: true,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  return JSON.stringify({
    operatorCount: operators.length,
    equipmentCount: detailed.filter((row) => !row.error).length,
    errors: detailed.filter((row) => row.error),
    profiles: detailed.filter((row) => !row.error),
  });
})()
`;

const raw = await evaluate(browserExpression);
const result = JSON.parse(raw);
if (!result.profiles?.length) throw new Error("No public equipment profiles were extracted");

const apiHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
  Prefer: "resolution=merge-duplicates,return=representation",
};

let imported = 0;
for (let index = 0; index < result.profiles.length; index += 75) {
  const batch = result.profiles.slice(index, index + 75);
  const response = await fetch(`${supabaseUrl}/rest/v1/unclaimed_truck_directory?on_conflict=source_key`, {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify(batch),
  });
  if (!response.ok) throw new Error(`Supabase upsert failed: ${response.status} ${await response.text()}`);
  imported += (await response.json()).length;
  process.stdout.write(`Imported ${imported}/${result.profiles.length}\n`);
}

process.stdout.write(JSON.stringify({
  operatorsWithEquipment: result.operatorCount,
  equipmentFound: result.equipmentCount,
  imported,
  extractionErrors: result.errors.length,
}, null, 2) + "\n");
