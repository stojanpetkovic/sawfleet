import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

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
    
    const { leadId, assignedTo } = json;

    if (!leadId || !assignedTo) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing leadId or assignedTo' }), { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(assignedTo)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email format' }), { status: 400 });
    }

    // Update in external_leads with assigned_to field
    const { data, error } = await supabase
      .from('external_leads')
      .update({ 
        assigned_to: assignedTo,
        permit_status: 'transferred'
      })
      .eq('id', leadId)
      .select();

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Lead not found' }), { status: 404 });
    }

    // Log the transfer
    await supabase.from('lead_logs').insert({
      lead_id: leadId,
      action: `Lead transferred to: ${assignedTo}`,
      notes: 'Team member reassignment'
    });

    return new Response(JSON.stringify({ ok: true, lead: data[0] }), { status: 200 });
  } catch (error: any) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
};
