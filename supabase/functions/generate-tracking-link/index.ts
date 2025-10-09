import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateLinkRequest {
  sender_email: string;
  recipient_email: string;
  banner_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sender_email, recipient_email, banner_id }: GenerateLinkRequest = await req.json();

    if (!sender_email || !recipient_email || !banner_id) {
      throw new Error("Missing required parameters: sender_email, recipient_email, banner_id");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if a tracking session already exists for this combination
    const { data: existingSession } = await supabase
      .from('email_tracking_sessions')
      .select('tracking_id')
      .eq('sender_email', sender_email)
      .eq('recipient_email', recipient_email)
      .eq('banner_id', banner_id)
      .gt('expires_at', new Date().toISOString())
      .single();

    let trackingId: string;

    if (existingSession) {
      // Reuse existing tracking ID
      trackingId = existingSession.tracking_id;
      console.log(`Reusing existing tracking ID: ${trackingId}`);
    } else {
      // Generate new tracking ID
      const { data: newTrackingId, error: generateError } = await supabase
        .rpc('generate_tracking_id');

      if (generateError || !newTrackingId) {
        throw new Error(`Failed to generate tracking ID: ${generateError?.message}`);
      }

      trackingId = newTrackingId;

      // Store new tracking session
      const { error: insertError } = await supabase
        .from('email_tracking_sessions')
        .insert({
          tracking_id: trackingId,
          sender_email,
          recipient_email,
          banner_id,
        });

      if (insertError) {
        throw new Error(`Failed to create tracking session: ${insertError.message}`);
      }

      console.log(`Created new tracking session: ${trackingId}`);
    }

    // Generate tracking URL
    const trackingUrl = `${supabaseUrl}/functions/v1/track-banner-click?tid=${trackingId}`;

    return new Response(
      JSON.stringify({
        success: true,
        tracking_id: trackingId,
        tracking_url: trackingUrl,
        sender_email,
        recipient_email,
        banner_id,
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
    console.error("Generate tracking link error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
