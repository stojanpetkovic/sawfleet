import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    let json;
    try {
      json = await request.json();
    } catch (err: any) {
      console.error('Failed to parse JSON:', err.message);
      throw err;
    }
    
    const { leadId, status } = json || {};

    if (!leadId || !status) {
      console.log('Missing params:', { leadId, status });
      return new Response(JSON.stringify({ ok: false, error: 'Missing leadId or status', received: json }), { status: 400 });
    }

    const validStatuses = ['new', 'invited', 'responded', 'converted'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid status' }), { status: 400 });
    }

    // Update in external_leads (where permits are stored)
    const { data, error } = await supabase
      .from('external_leads')
      .update({ permit_status: status })
      .eq('id', leadId)
      .select();

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Lead not found' }), { status: 404 });
    }

    // Log the status change
    await supabase.from('lead_logs').insert({
      lead_id: leadId,
      action: `Status updated to: ${status}`,
      notes: 'Manual status change'
    });

    return new Response(JSON.stringify({ ok: true, lead: data[0] }), { status: 200 });
  } catch (error: any) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
};
