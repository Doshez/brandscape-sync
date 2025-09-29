import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeployRequest {
  user_id: string;
  signature_id?: string;
  banner_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, signature_id, banner_id }: DeployRequest = await req.json();

    if (!user_id) {
      throw new Error("Missing required parameter: user_id");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's Exchange connections
    const { data: connections, error: connectionsError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true);

    if (connectionsError) {
      throw new Error("Failed to fetch Exchange connections");
    }

    if (!connections || connections.length === 0) {
      throw new Error("No active Exchange connections found for this user");
    }

    // Get signature if provided
    let signatureHtml = '';
    if (signature_id) {
      const { data: signature } = await supabase
        .from('email_signatures')
        .select('html_content')
        .eq('id', signature_id)
        .eq('user_id', user_id)
        .single();
      
      if (signature) {
        signatureHtml = signature.html_content;
      }
    }

    // Get banner if provided
    let bannerHtml = '';
    if (banner_id) {
      const { data: banner } = await supabase
        .from('banners')
        .select('html_content')
        .eq('id', banner_id)
        .eq('is_active', true)
        .single();
      
      if (banner) {
        bannerHtml = banner.html_content;
      }
    }

    // Combine signature and banner HTML
    let combinedHtml = '';
    if (bannerHtml && signatureHtml) {
      combinedHtml = `${bannerHtml}<br/><br/>${signatureHtml}`;
    } else if (bannerHtml) {
      combinedHtml = bannerHtml;
    } else if (signatureHtml) {
      combinedHtml = signatureHtml;
    }

    if (!combinedHtml) {
      throw new Error("No signature or banner content to deploy");
    }

    const deploymentResults = [];

    // Deploy to each connected Exchange account
    for (const connection of connections) {
      try {
        // Check if token is expired and refresh if needed
        const tokenExpiresAt = new Date(connection.token_expires_at);
        const now = new Date();
        
        let accessToken = connection.access_token;
        
        if (tokenExpiresAt <= now) {
          // Token is expired, refresh it
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
              scope: "https://graph.microsoft.com/Mail.ReadWrite offline_access",
            }),
          });

          if (refreshResponse.ok) {
            const tokenData = await refreshResponse.json();
            accessToken = tokenData.access_token;
            
            // Update the connection with new tokens
            const newExpiresAt = new Date(now.getTime() + (tokenData.expires_in * 1000));
            await supabase
              .from('exchange_connections')
              .update({
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token || connection.refresh_token,
                token_expires_at: newExpiresAt.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', connection.id);
          } else {
            console.error(`Failed to refresh token for ${connection.email}`);
            continue;
          }
        }

        // Deploy combined signature and banner to Exchange
        const deployResult = await deployToExchange(accessToken, combinedHtml, connection.email);
        
        deploymentResults.push({
          email: connection.email,
          success: deployResult.success,
          error: deployResult.error
        });

        // Log the deployment
        await supabase
          .from('analytics_events')
          .insert({
            event_type: 'signature_banner_deployed',
            user_id: connection.user_id,
            email_recipient: connection.email,
            metadata: {
              signature_id: signature_id,
              banner_id: banner_id,
              deployment_success: deployResult.success
            }
          });

      } catch (error) {
        console.error(`Deployment failed for ${connection.email}:`, error);
        deploymentResults.push({
          email: connection.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successfulDeployments = deploymentResults.filter(r => r.success).length;
    const totalDeployments = deploymentResults.length;

    return new Response(
      JSON.stringify({
        success: successfulDeployments > 0,
        message: `Signature and banner deployed to ${successfulDeployments}/${totalDeployments} Exchange accounts`,
        results: deploymentResults,
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
    console.error("Deployment error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function deployToExchange(accessToken: string, combinedHtml: string, userEmail: string) {
  try {
    // Get current mailbox settings
    const mailboxResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailboxSettings", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!mailboxResponse.ok) {
      const error = await mailboxResponse.json();
      throw new Error(`Failed to get mailbox settings: ${error.error?.message}`);
    }

    const mailboxSettings = await mailboxResponse.json();

    // Update the automatic replies with combined signature and banner
    const updatedSettings = {
      ...mailboxSettings,
      automaticRepliesSetting: {
        ...mailboxSettings.automaticRepliesSetting,
        externalReplyMessage: combinedHtml,
        internalReplyMessage: combinedHtml,
      },
    };

    // Update mailbox settings
    const updateResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailboxSettings", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedSettings),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update signature and banner: ${error.error?.message}`);
    }

    return { success: true, error: null };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

serve(handler);