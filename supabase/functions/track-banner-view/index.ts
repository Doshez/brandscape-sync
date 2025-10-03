import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackViewRequest {
  banner_id: string;
  user_email?: string;
  user_agent?: string;
  referrer?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both query params and POST body
    const url = new URL(req.url);
    let banner_id = url.searchParams.get('banner_id');
    let user_email = url.searchParams.get('email');

    // If POST, try to get from body as well
    if (req.method === 'POST') {
      const body: TrackViewRequest = await req.json();
      banner_id = body.banner_id || banner_id;
      user_email = body.user_email || user_email;
    }

    if (!banner_id) {
      throw new Error("Missing required parameter: banner_id");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client IP address (take only the first IP if multiple are present)
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    console.log(`Tracking view for banner ${banner_id} from ${user_email || 'unknown user'}`);

    // Record the view event
    const { error: eventError } = await supabase
      .from('analytics_events')
      .insert({
        event_type: 'view',
        banner_id: banner_id,
        email_recipient: user_email || null,
        user_agent: req.headers.get('user-agent'),
        ip_address: clientIP,
        referrer: req.headers.get('referer'),
        metadata: {},
        timestamp: new Date().toISOString()
      });

    if (eventError) {
      console.error("Failed to record view event:", eventError);
    } else {
      console.log(`Successfully recorded view for banner ${banner_id}`);
    }

    // Return a 1x1 transparent GIF pixel
    const transparentGif = Uint8Array.from(
      atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
      c => c.charCodeAt(0)
    );

    return new Response(transparentGif, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("View tracking error:", error);
    
    // Still return a pixel even on error so email rendering isn't affected
    const transparentGif = Uint8Array.from(
      atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
      c => c.charCodeAt(0)
    );

    return new Response(transparentGif, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        ...corsHeaders,
      },
    });
  }
};

serve(handler);
