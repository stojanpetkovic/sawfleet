// Server-only helper — NIKAD ne importuj ovo u <script> (client) blok,
// samo u .astro frontmatter ili u src/pages/api/*.ts fajlove.
// RESEND_API_KEY namerno NIJE prefiksovan sa PUBLIC_, pa Astro
// ne sme da ga ubaci u JS bundle koji ide u browser.

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const FROM_EMAIL = import.meta.env.RESEND_FROM_EMAIL || "SF Tree Removal <notifications@sftreeremoval.com>";

/**
 * @param {{ to: string | string[], subject: string, html: string, headers?: Record<string,string>, tags?: {name:string,value:string}[] }} params
 */
export async function sendEmail({ to, subject, html, headers, tags }) {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY nije podešen u .env — email nije poslat.");
    return { ok: false, error: "missing_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        ...(headers ? { headers } : {}),
        ...(tags ? { tags } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      return { ok: false, error: errText };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.error("Resend request failed:", err);
    return { ok: false, error: String(err) };
  }
}

// ================= EMAIL TEMPLATES =================

export function newLeadEmailHtml({ companyName, county, details, dashboardUrl }) {
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// New Dispatch</p>
    <h1 style="font-size:22px; margin:0 0 16px;">New lead in your territory</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">Hi${companyName ? " " + companyName : ""}, a new tree service request just came in for <strong>${county}</strong>.</p>
    <p style="color:#64748B; font-size:13px; line-height:1.6; border-left:2px solid #E2E8F0; padding-left:12px;">${details ? details.slice(0, 140) : "Details available once you sign in."}</p>
    <p style="color:#D97706; font-size:12px; margin:20px 0;">⚡ First to claim it gets the contact info — act fast.</p>
    <a href="${dashboardUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Claim this lead →</a>
  </div>`;
}

export function permitLeadOutreachEmailHtml({ fullName, permitDetails, siteUrl }) {
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// Permit Outreach</p>
    <h1 style="font-size:22px; margin:0 0 16px;">We can help with your permit project</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">Hi${fullName ? " " + fullName : ""}, we noticed a recent permit opportunity that may be relevant to your project.</p>
    <p style="color:#64748B; font-size:13px; line-height:1.6; border-left:2px solid #E2E8F0; padding-left:12px;">${permitDetails ? permitDetails.slice(0, 240) : "We can review the work scope and help you get the right contractor or next steps."}</p>
    <p style="color:#D97706; font-size:12px; margin:20px 0;">If you want, we can help you evaluate the opportunity, confirm the scope, and connect you with the right service provider.</p>
    <a href="${siteUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">View our service options →</a>
  </div>`;
}

export function contractorStatusEmailHtml({ companyName, status, loginUrl }) {
  const approved = status === "active";
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:${approved ? "#16803C" : "#DC2626"}; font-weight:bold; margin:0 0 12px;">// Account ${approved ? "Approved" : "Update"}</p>
    <h1 style="font-size:22px; margin:0 0 16px;">${approved ? "Your account is approved!" : "Your account status has been updated"}</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">
      Hi${companyName ? " " + companyName : ""}, ${approved
        ? "your contractor profile has been approved. You can now view and claim available leads."
        : "unfortunately your profile is not currently approved. Please contact the administrator for more information."}
    </p>
    ${approved ? `<a href="${loginUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Sign in →</a>` : ""}
  </div>`;
}

export function truckOwnerStatusEmailHtml({ ownerName, status, loginUrl }) {
  const approved = status === "approved";
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:${approved ? "#16803C" : "#DC2626"}; font-weight:bold; margin:0 0 12px;">// Fleet Account ${approved ? "Approved" : "Update"}</p>
    <h1 style="font-size:22px; margin:0 0 16px;">${approved ? "Your account is approved!" : "Your account status has been updated"}</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">
      Hi${ownerName ? " " + ownerName : ""}, ${approved
        ? "your fleet owner account has been approved. You can now add trucks and start receiving dispatch requests."
        : "unfortunately your fleet owner account is not currently approved. Please contact the administrator for more information."}
    </p>
    ${approved ? `<a href="${loginUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Sign in →</a>` : ""}
  </div>`;
}

export function customerTrackingEmailHtml({ county, dashboardUrl, accountUrl }) {
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// Request Received</p>
    <h1 style="font-size:22px; margin:0 0 16px;">We've got your request${county ? ` for ${county}` : ""}</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">We're matching you with a qualified local contractor now. Use the secure link below anytime to check the status of your request — no password needed.</p>
    <a href="${dashboardUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Track your request →</a>
    <p style="color:#94A3B8; font-size:11px; margin-top:20px; line-height:1.5;">This link expires after a short time. You can always request a new one at <a href="${accountUrl}" style="color:#64748B;">${accountUrl}</a>.</p>
  </div>`;
}

export function verifySignupEmailHtml({ name, verifyUrl }) {
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// Confirm Your Email</p>
    <h1 style="font-size:22px; margin:0 0 16px;">One step left</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">Hi${name ? " " + name : ""}, confirm your email to submit your application for review.</p>
    <a href="${verifyUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Confirm email →</a>
    <p style="color:#94A3B8; font-size:11px; margin-top:20px; line-height:1.5;">This link expires in 48 hours. If you didn't request this, you can ignore this email.</p>
  </div>`;
}

export function routedExternalLeadEmailHtml({ recipientName, sourceDomain, fullName, message, dashboardUrl }) {
  return `
  <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#FFFFFF; color:#0F172A; padding:32px; border-radius:16px; border:1px solid #E7EAE8;">
    <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#16803C; font-weight:bold; margin:0 0 12px;">// Priority Referral</p>
    <h1 style="font-size:22px; margin:0 0 16px;">A new lead just arrived${sourceDomain ? ` from ${sourceDomain}` : ""}</h1>
    <p style="color:#475569; font-size:14px; line-height:1.6;">Hi${recipientName ? " " + recipientName : ""}, you're set up as a priority partner for this source — this lead is already in your dashboard with full contact info, no credits required to accept it.</p>
    <p style="color:#64748B; font-size:13px; line-height:1.6; border-left:2px solid #E2E8F0; padding-left:12px;">${fullName ? `<strong>${fullName}</strong><br/>` : ""}${message ? message.slice(0, 140) : "Details available in your dashboard."}</p>
    <p style="color:#D97706; font-size:12px; margin:20px 0;">⚡ First to accept keeps it — no charge either way.</p>
    <a href="${dashboardUrl}" style="display:inline-block; margin-top:8px; background:#22C55E; color:#FFFFFF; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">View in dashboard →</a>
  </div>`;
}
