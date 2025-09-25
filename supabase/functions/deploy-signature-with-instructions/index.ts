import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeployRequest {
  signature_id: string;
  user_emails?: string[];
  send_instructions?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signature_id, user_emails, send_instructions = true }: DeployRequest = await req.json();

    if (!signature_id) {
      throw new Error("Missing required parameter: signature_id");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get signature details
    const { data: signature, error: signatureError } = await supabase
      .from('email_signatures')
      .select('*')
      .eq('id', signature_id)
      .single();

    if (signatureError || !signature) {
      throw new Error("Signature not found");
    }

    // Get Exchange connections
    let connectionsQuery = supabase
      .from('exchange_connections')
      .select('*')
      .eq('is_active', true);

    if (user_emails && user_emails.length > 0) {
      connectionsQuery = connectionsQuery.in('email', user_emails);
    }

    const { data: connections, error: connectionsError } = await connectionsQuery;

    if (connectionsError) {
      throw new Error("Failed to fetch Exchange connections");
    }

    if (!connections || connections.length === 0) {
      throw new Error("No active Exchange connections found");
    }

    const deploymentResults = [];

    for (const connection of connections) {
      try {
        // Check token expiration and refresh if needed
        const tokenExpiresAt = new Date(connection.token_expires_at);
        const now = new Date();
        let accessToken = connection.access_token;

        if (tokenExpiresAt <= now) {
          const refreshResult = await refreshAccessToken(connection);
          if (!refreshResult.success) {
            deploymentResults.push({
              email: connection.email,
              success: false,
              error: "Token refresh failed"
            });
            continue;
          }
          accessToken = refreshResult.accessToken;
          
          // Update connection in database
          await supabase
            .from('exchange_connections')
            .update({
              access_token: refreshResult.accessToken,
              refresh_token: refreshResult.refreshToken || connection.refresh_token,
              token_expires_at: refreshResult.expiresAt,
              updated_at: now.toISOString()
            })
            .eq('id', connection.id);
        }

        // Deploy signature (set as automatic reply for now)
        const deployResult = await deployToExchange(accessToken, signature.html_content);
        
        // Send setup instructions email if requested
        if (send_instructions && deployResult.success) {
          await sendSetupInstructions(accessToken, connection.email, signature);
        }

        deploymentResults.push({
          email: connection.email,
          success: deployResult.success,
          error: deployResult.error,
          instructions_sent: send_instructions
        });

        // Log deployment
        await supabase
          .from('analytics_events')
          .insert({
            event_type: 'signature_deployed',
            user_id: connection.user_id,
            email_recipient: connection.email,
            metadata: {
              signature_id: signature.id,
              signature_name: signature.template_name,
              deployment_success: deployResult.success,
              instructions_sent: send_instructions
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

    const successCount = deploymentResults.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: `Signature deployed to ${successCount}/${deploymentResults.length} accounts${send_instructions ? ' with setup instructions' : ''}`,
        results: deploymentResults,
        next_steps: [
          "Users will receive setup instructions via email",
          "Signatures are currently set as automatic replies",
          "Users need to manually copy signature to their Outlook settings for new emails"
        ]
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Deployment error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        microsoft_365_requirements: [
          "Ensure Azure App has Mail.ReadWrite and MailboxSettings.ReadWrite permissions",
          "Check that Exchange Online allows signature management",
          "Verify client credentials are not expired"
        ]
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

async function refreshAccessToken(connection: any) {
  try {
    const response = await fetch("https://login.microsoftonline.com/organizations/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
        client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
        refresh_token: connection.refresh_token,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/MailboxSettings.ReadWrite offline_access",
      }),
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    return { success: false };
  }
}

async function deployToExchange(accessToken: string, signatureHtml: string) {
  try {
    // Get current mailbox settings
    const mailboxResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailboxSettings", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!mailboxResponse.ok) {
      throw new Error("Failed to get mailbox settings");
    }

    const mailboxSettings = await mailboxResponse.json();

    // Update automatic replies with signature
    const updatedSettings = {
      ...mailboxSettings,
      automaticRepliesSetting: {
        ...mailboxSettings.automaticRepliesSetting,
        externalReplyMessage: signatureHtml,
        internalReplyMessage: signatureHtml,
      },
    };

    const updateResponse = await fetch("https://graph.microsoft.com/v1.0/me/mailboxSettings", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedSettings),
    });

    if (!updateResponse.ok) {
      throw new Error("Failed to update mailbox settings");
    }

    return { success: true, error: null };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

async function sendSetupInstructions(accessToken: string, userEmail: string, signature: any) {
  const instructionsHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2>Email Signature Setup Instructions</h2>
      <p>Your email signature "<strong>${signature.template_name}</strong>" has been partially deployed.</p>
      
      <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-left: 4px solid #007acc;">
        <h3>⚠️ Manual Setup Required</h3>
        <p>Due to Microsoft 365 limitations, you need to complete the setup manually:</p>
      </div>

      <h3>For Outlook Desktop/Web:</h3>
      <ol>
        <li>Open Outlook</li>
        <li>Go to <strong>File → Options → Mail → Signatures</strong></li>
        <li>Click "New" to create a signature</li>
        <li>Copy the signature HTML below and paste it</li>
        <li>Set it as default for new messages</li>
      </ol>

      <h3>Your Signature HTML:</h3>
      <div style="border: 1px solid #ddd; padding: 10px; background: #f9f9f9; font-family: monospace; font-size: 12px; overflow-x: auto;">
        ${signature.html_content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>

      <h3>Preview:</h3>
      <div style="border: 1px solid #ddd; padding: 15px; background: white;">
        ${signature.html_content}
      </div>

      <p><em>This signature has been set as your automatic reply message and will appear in out-of-office responses.</em></p>
    </div>
  `;

  try {
    await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: `Email Signature Setup - ${signature.template_name}`,
          body: {
            contentType: "HTML",
            content: instructionsHtml
          },
          toRecipients: [{
            emailAddress: {
              address: userEmail
            }
          }]
        }
      })
    });
  } catch (error) {
    console.error("Failed to send setup instructions:", error);
  }
}

serve(handler);