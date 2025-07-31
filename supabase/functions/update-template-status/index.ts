import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface UpdateTemplateStatusRequest {
  templateId: string;
  status: 'draft' | 'pending' | 'approved' | 'archived';
  comment?: string;
}

const VALID_TRANSITIONS = {
  'draft': ['pending'],
  'pending': ['approved', 'draft'],
  'approved': ['archived'],
  'archived': ['draft']
};

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'PATCH',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      });
    }

    // Method validation
    if (req.method !== 'PATCH') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Only PATCH method is allowed' }
        }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get request body
    const { templateId, status, comment = '' } = await req.json() as UpdateTemplateStatusRequest;

    // Validate required fields
    if (!templateId || !status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Template ID and status are required' }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get current template
    const { data: template, error: templateError } = await supabaseClient
      .from('templates')
      .select('status')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Template not found' }
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate status transition
    const validNextStates = VALID_TRANSITIONS[template.status as keyof typeof VALID_TRANSITIONS];
    if (!validNextStates?.includes(status)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from ${template.status} to ${status}`
          }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Start transaction
    const { data, error } = await supabaseClient.rpc('update_template_status', {
      p_template_id: templateId,
      p_old_status: template.status,
      p_new_status: status,
      p_comment: comment,
      p_approved_by: 'test@example.com' // テスト用に固定値を使用
    });

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'UPDATE_FAILED', message: error.message }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}); 