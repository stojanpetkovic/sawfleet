import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendEmail } from '../../lib/resend';

export const POST: APIRoute = async ({ request }) => {
  try {
    const bodyText = await request.text();
    
    if (!bodyText) {
      return new Response(JSON.stringify({ ok: false, error: 'Empty request body' }), { status: 400 });
    }

    let json;
    try {
      json = JSON.parse(bodyText);
    } catch (parseError: any) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON: ' + parseError.message }), { status: 400 });
    }
    
    const { leadId } = json;

    if (!leadId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing leadId' }), { status: 400 });
    }

    // Fetch the permit lead from API
    const leadResponse = await fetch('http://localhost:3000/api/permit-leads');
    const payload = await leadResponse.json();
    
    if (!payload.ok || !payload.leads) {
      return new Response(JSON.stringify({ ok: false, error: 'Could not fetch lead' }), { status: 500 });
    }

    const lead = payload.leads.find((l: any) => l.id === leadId);
    if (!lead || !lead.owner_email) {
      return new Response(JSON.stringify({ ok: false, error: 'Lead not found or no email' }), { status: 404 });
    }

    // Send email using Resend
    const emailResult = await sendEmail({
      to: lead.owner_email,
      subject: `Permit Opportunity at ${lead.address}`,
      html: `
        <h2>Permit Service Opportunity</h2>
        <p>Hi ${lead.owner_name || 'there'},</p>
        <p>We noticed a permit filing for your property at:</p>
        <p><strong>${lead.address}</strong></p>
        <p><strong>Jurisdiction:</strong> ${lead.jurisdiction}</p>
        <p><strong>Permit Type:</strong> ${lead.permit_type}</p>
        ${lead.permit_description ? `<p><strong>Details:</strong> ${lead.permit_description}</p>` : ''}
        <p>We specialize in permit-related services and would like to discuss how we can assist you.</p>
        <p>Feel free to reach out if you have any questions.</p>
        <p>Best regards,<br>SawFleet Team</p>
      `
    });

    if (!emailResult.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Failed to send email: ' + emailResult.error }), { status: 500 });
    }

    // Log the outreach
    await supabase.from('lead_logs').insert({
      lead_id: leadId,
      action: `Sent outreach email to ${lead.owner_email}`,
      notes: 'Permit email campaign'
    });

    return new Response(JSON.stringify({ ok: true, messageId: emailResult.data.id }), { status: 200 });
  } catch (error: any) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
};
