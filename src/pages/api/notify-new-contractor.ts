export const prerender = false;

import { supabase } from "../../lib/supabase";
import { sendEmail } from "../../lib/resend";

export async function POST({ request }) {
  try {
    const { companyName, territory } = await request.json();

    const { data: admins, error } = await supabase.rpc('get_admin_emails');
    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 });
    }

    const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

    const results = await Promise.all(
      (admins || []).map((a) =>
        sendEmail({
          to: a.email,
          subject: `Nova prijava izvođača: ${companyName}`,
          html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background:#0B0F0C; color:#F8FAF9; padding:32px; border-radius:16px;">
            <p style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#4CAF50; font-weight:bold; margin:0 0 12px;">// New Application</p>
            <h1 style="font-size:22px; margin:0 0 16px;">Nova prijava izvođača</h1>
            <p style="color:#CDD5CF; font-size:14px; line-height:1.6;"><strong>${companyName}</strong> se prijavio(la) za teritoriju <strong>${territory}</strong> i čeka tvoje odobrenje.</p>
            <a href="${siteUrl}/admin/contractors" style="display:inline-block; margin-top:8px; background:#4CAF50; color:#0B0F0C; text-decoration:none; font-weight:bold; font-size:13px; padding:12px 24px; border-radius:10px;">Pregledaj prijavu →</a>
          </div>`,
        })
      )
    );

    return new Response(JSON.stringify({ sent: results.filter((r) => r.ok).length }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'unexpected_error' }), { status: 500 });
  }
}
