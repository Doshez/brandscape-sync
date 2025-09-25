import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UniversalDeployRequest {
  target_user_id: string;
  admin_user_id: string;
  signature_id?: string;
  banner_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { target_user_id, admin_user_id, signature_id, banner_id }: UniversalDeployRequest = await req.json();

    if (!target_user_id || !admin_user_id) {
      throw new Error("Missing required parameters: target_user_id and admin_user_id");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get target user profile
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('user_id', target_user_id)
      .single();

    if (userError || !targetUser) {
      throw new Error("Target user not found");
    }

    if (!targetUser.email) {
      throw new Error("Target user has no email address");
    }

    // Get admin's Exchange connection
    const { data: adminConnections, error: connectionsError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('user_id', admin_user_id)
      .eq('is_active', true);

    if (connectionsError) {
      throw new Error("Failed to fetch admin Exchange connections");
    }

    if (!adminConnections || adminConnections.length === 0) {
      throw new Error("Admin has no active Exchange connections");
    }

    // Use the first admin connection
    const adminConnection = adminConnections[0];

    // Extract domain from admin and target emails
    const adminDomain = adminConnection.email.split('@')[1].toLowerCase();
    const targetDomain = targetUser.email.split('@')[1].toLowerCase();

    if (adminDomain !== targetDomain) {
      throw new Error(`Cannot deploy to user from different domain. Admin: ${adminDomain}, Target: ${targetDomain}`);
    }

    // Get signature if provided
    let signatureHtml = '';
    if (signature_id) {
      const { data: signature } = await supabase
        .from('email_signatures')
        .select('html_content')
        .eq('id', signature_id)
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

    // Check if admin token is expired and refresh if needed
    const tokenExpiresAt = new Date(adminConnection.token_expires_at);
    const now = new Date();
    
    let accessToken = adminConnection.access_token;
    
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
          refresh_token: adminConnection.refresh_token,
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
            refresh_token: tokenData.refresh_token || adminConnection.refresh_token,
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', adminConnection.id);
      } else {
        throw new Error("Failed to refresh admin access token");
      }
    }

    // Deploy to target user's Exchange mailbox using admin's token
    const deployResult = await deployToTargetUserExchange(
      accessToken, 
      combinedHtml, 
      targetUser.email,
      adminConnection.email
    );

    // Log the deployment
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'universal_signature_banner_deployed',
        user_id: admin_user_id,
        email_recipient: targetUser.email,
        metadata: {
          signature_id: signature_id,
          banner_id: banner_id,
          target_user_id: target_user_id,
          admin_email: adminConnection.email,
          deployment_success: deployResult.success
        }
      });

    if (!deployResult.success) {
      throw new Error(deployResult.error || "Deployment failed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Signature and banner deployed to ${targetUser.email} using admin connection ${adminConnection.email}`,
        result: {
          target_email: targetUser.email,
          admin_email: adminConnection.email,
          success: deployResult.success
        }
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
    console.error("Universal deployment error:", error);
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

async function deployToTargetUserExchange(
  adminAccessToken: string, 
  combinedHtml: string, 
  targetUserEmail: string,
  adminEmail: string
) {
  try {
    // Use admin token to access target user's mailbox settings
    // Note: This requires admin consent and appropriate permissions in Microsoft Graph
    const userResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}`, {
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.json();
      throw new Error(`Failed to access target user: ${error.error?.message}`);
    }

    // Get target user's mailbox settings
    const mailboxResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}/mailboxSettings`, {
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!mailboxResponse.ok) {
      const error = await mailboxResponse.json();
      throw new Error(`Failed to get target user's mailbox settings: ${error.error?.message}`);
    }

    const mailboxSettings = await mailboxResponse.json();

    // Update the target user's automatic replies with combined signature and banner
    const updatedSettings = {
      ...mailboxSettings,
      automaticRepliesSetting: {
        ...mailboxSettings.automaticRepliesSetting,
        externalReplyMessage: combinedHtml,
        internalReplyMessage: combinedHtml,
      },
    };

    // Update target user's mailbox settings
    const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}/mailboxSettings`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedSettings),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update target user's signature and banner: ${error.error?.message}`);
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