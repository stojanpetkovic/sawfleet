export const prerender = false;

import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { authorizeAutomationRequest } from '../../lib/automationAuth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const authorization = await authorizeAutomationRequest(request);
    if (!authorization.authorized) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
    }
    if (!supabaseAdmin) return new Response(JSON.stringify({ ok: false, error: 'service_role_not_configured' }), { status: 500 });

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

    // Delete from external_leads
    const { error } = await supabaseAdmin
      .from('external_leads')
      .delete()
      .eq('id', leadId);

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    // Also delete associated logs
    await supabaseAdmin
      .from('lead_logs')
      .delete()
      .eq('lead_id', leadId);

    return new Response(JSON.stringify({ ok: true, message: 'Lead deleted successfully' }), { status: 200 });
  } catch (error: any) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
};
