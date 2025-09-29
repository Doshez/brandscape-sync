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
    const { 
      banner_id, 
      campaign_id, 
      user_email, 
      user_agent, 
      referrer,
      metadata 
    }: TrackClickRequest = await req.json();

    if (!banner_id) {
      throw new Error("Missing required parameter: banner_id");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client IP address
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';

    // Record the click event
    const { error: eventError } = await supabase
      .from('analytics_events')
      .insert({
        event_type: 'click',
        banner_id: banner_id,
        campaign_id: campaign_id || null,
        email_recipient: user_email || null,
        user_agent: user_agent || req.headers.get('user-agent'),
        ip_address: clientIP,
        referrer: referrer || req.headers.get('referer'),
        metadata: metadata || {},
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

    // Return the redirect URL
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