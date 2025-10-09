import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TrackClickRequest {
  banner_id: string;
  campaign_id?: string;
  user_email?: string;
  user_agent?: string;
  referrer?: string;
  metadata?: any;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (with query params) and POST (with body)
    const url = new URL(req.url);
    let banner_id = url.searchParams.get('banner_id');
    let user_email = url.searchParams.get('email');
    const tracking_id = url.searchParams.get('tid'); // New: tracking ID for recipient tracking
    let campaign_id, user_agent, referrer, metadata;
    let sender_email: string | null = null;
    let recipient_email: string | null = null;

    // If POST, try to get from body as well
    if (req.method === 'POST') {
      const body: TrackClickRequest = await req.json();
      banner_id = body.banner_id || banner_id;
      campaign_id = body.campaign_id;
      user_email = body.user_email || user_email;
      user_agent = body.user_agent;
      referrer = body.referrer;
      metadata = body.metadata;
    } else {
      user_agent = req.headers.get('user-agent') || undefined;
      referrer = req.headers.get('referer') || undefined;
    }

    // Initialize Supabase client early for tracking ID lookup
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If tracking_id is provided, look up sender and recipient
    if (tracking_id) {
      const { data: session, error: sessionError } = await supabase
        .from('email_tracking_sessions')
        .select('*')
        .eq('tracking_id', tracking_id)
        .single();

      if (session && !sessionError) {
        sender_email = session.sender_email;
        recipient_email = session.recipient_email;
        banner_id = session.banner_id;
        
        // Update session stats
        await supabase
          .from('email_tracking_sessions')
          .update({
            click_count: session.click_count + 1,
            last_clicked_at: new Date().toISOString(),
          })
          .eq('tracking_id', tracking_id);

        console.log(`Tracking session found: sender=${sender_email}, recipient=${recipient_email}`);
      } else {
        console.warn(`Tracking session not found for ID: ${tracking_id}`);
      }
    }

    if (!banner_id) {
      throw new Error("Missing required parameter: banner_id or valid tracking_id");
    }

    // Get client IP address (take only the first IP if multiple are present)
    const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';

    // Record the click event with both sender and recipient info
    const eventMetadata: any = metadata || {};
    if (sender_email) eventMetadata.sender_email = sender_email;
    if (recipient_email) eventMetadata.recipient_email = recipient_email;
    if (tracking_id) eventMetadata.tracking_id = tracking_id;

    const { error: eventError } = await supabase
      .from('analytics_events')
      .insert({
        event_type: 'click',
        banner_id: banner_id,
        campaign_id: campaign_id || null,
        email_recipient: recipient_email || user_email || null, // Prioritize recipient from tracking session
        user_agent: user_agent || req.headers.get('user-agent'),
        ip_address: clientIP,
        referrer: referrer || req.headers.get('referer'),
        metadata: eventMetadata,
        timestamp: new Date().toISOString()
      });

    if (eventError) {
      console.error("Failed to record click event:", eventError);
      // Don't fail the request if analytics recording fails
    }

    // Increment banner click count using the database function
    const { error: incrementError } = await supabase
      .rpc('increment_banner_clicks', { banner_uuid: banner_id });

    if (incrementError) {
      console.error("Failed to increment banner clicks:", incrementError);
    }

    // Get the banner's click URL to redirect to
    const { data: banner, error: bannerError } = await supabase
      .from('banners')
      .select('click_url, max_clicks, current_clicks')
      .eq('id', banner_id)
      .single();

    if (bannerError || !banner) {
      throw new Error("Banner not found");
    }

    // Check if banner has reached max clicks
    if (banner.max_clicks && banner.current_clicks >= banner.max_clicks) {
      // Deactivate the banner
      await supabase
        .from('banners')
        .update({ is_active: false })
        .eq('id', banner_id);
    }

    // For GET requests (direct link clicks), redirect to the click URL
    // For POST requests (programmatic), return JSON with redirect URL
    if (req.method === 'GET') {
      return Response.redirect(banner.click_url, 302);
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          redirect_url: banner.click_url,
          message: "Click tracked successfully"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

  } catch (error: any) {
    console.error("Click tracking error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        redirect_url: null
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);