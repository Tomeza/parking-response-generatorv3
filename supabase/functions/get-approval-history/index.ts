import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface PaginationParams {
  page?: number;
  per_page?: number;
}

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      });
    }

    // Method validation
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Only GET method is allowed' }
        }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get URL parameters
    const url = new URL(req.url);
    const templateId = url.searchParams.get('templateId');
    const page = parseInt(url.searchParams.get('page') ?? '1');
    const per_page = parseInt(url.searchParams.get('per_page') ?? '10');

    // Validate required parameters
    if (!templateId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Template ID is required' }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate pagination parameters
    if (isNaN(page) || page < 1 || isNaN(per_page) || per_page < 1 || per_page > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid pagination parameters' }
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate offset
    const offset = (page - 1) * per_page;

    // Get approval history
    const { data: history, error: historyError, count } = await supabaseClient
      .from('template_approval_history')
      .select('*', { count: 'exact' })
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })
      .range(offset, offset + per_page - 1);

    if (historyError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'QUERY_ERROR', message: historyError.message }
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate pagination metadata
    const total_pages = Math.ceil((count ?? 0) / per_page);
    const has_next = page < total_pages;
    const has_previous = page > 1;

    return new Response(
      JSON.stringify({
        success: true,
        data: history,
        pagination: {
          current_page: page,
          per_page,
          total_items: count,
          total_pages,
          has_next,
          has_previous
        }
      }),
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