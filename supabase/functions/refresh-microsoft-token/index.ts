import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefreshTokenRequest {
  connection_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from JWT header (JWT is automatically verified by Supabase when verify_jwt = true)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Extract user ID from JWT payload (Supabase automatically validates the JWT)
    const jwt = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(jwt.split('.')[1]));
    const userId = payload.sub;
    
    if (!userId) {
      throw new Error('Invalid JWT token - missing user ID');
    }

    console.log('User authenticated:', userId);

    const { connection_id }: RefreshTokenRequest = await req.json();

    if (!connection_id) {
      throw new Error('Connection ID is required');
    }

    // Get the connection - only allow users to refresh their own connections, or admins to refresh any
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    let connectionQuery = supabase
      .from('exchange_connections')
      .select('*')
      .eq('id', connection_id);

    if (!profile?.is_admin) {
      connectionQuery = connectionQuery.eq('user_id', userId);
    }

    const { data: connection, error: connectionError } = await connectionQuery.single();

    if (connectionError || !connection) {
      throw new Error('Connection not found or access denied');
    }

    // Test current token first
    const testResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
    });

    if (testResponse.ok) {
      // Token is still valid
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Connection is already active',
          token_status: 'valid'
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

    // Token needs refresh
    console.log('Token expired, refreshing for:', connection.email);

    const refreshResponse = await fetch("https://login.microsoftonline.com/organizations/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
        client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/MailboxSettings.ReadWrite offline_access",
      }),
    });

    if (!refreshResponse.ok) {
      const errorData = await refreshResponse.json();
      console.error('Token refresh failed:', errorData);
      throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error}`);
    }

    const tokenData = await refreshResponse.json();
    
    // Update the connection with new tokens
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    
    const { error: updateError } = await supabase
      .from('exchange_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || connection.refresh_token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    if (updateError) {
      console.error('Failed to update connection:', updateError);
      throw new Error('Failed to save refreshed tokens');
    }

    // Log the refresh event
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'microsoft_token_refreshed',
        user_id: userId,
        email_recipient: connection.email,
        metadata: {
          connection_id: connection.id,
          expires_at: newExpiresAt.toISOString()
        }
      });

    console.log('Token successfully refreshed for:', connection.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully refreshed connection for ${connection.email}`,
        token_status: 'refreshed',
        expires_at: newExpiresAt.toISOString()
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
    console.error("Token refresh error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        token_status: 'error'
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);