import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UniversalDeployRequest {
  target_user_id?: string | null;
  target_profile_id?: string;
  admin_user_id: string;
  signature_id?: string;
  banner_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { target_user_id, target_profile_id, admin_user_id, signature_id, banner_id }: UniversalDeployRequest = await req.json();

    if ((!target_user_id && !target_profile_id) || !admin_user_id) {
      throw new Error("Missing required parameters: (target_user_id or target_profile_id) and admin_user_id");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get target user profile - handle both authenticated users and admin-created users
    let targetUserQuery = supabase
      .from('profiles')
      .select('email, first_name, last_name, user_id');

    if (target_user_id) {
      targetUserQuery = targetUserQuery.eq('user_id', target_user_id);
    } else if (target_profile_id) {
      targetUserQuery = targetUserQuery.eq('id', target_profile_id);
    }

    const { data: targetUser, error: userError } = await targetUserQuery.single();

    if (userError || !targetUser) {
      throw new Error("Target user not found");
    }

    if (!targetUser.email) {
      throw new Error("Target user has no email address");
    }

    // Security check: Only allow users to deploy to themselves
    // Get the admin user's profile to compare
    const { data: adminUser, error: adminError } = await supabase
      .from('profiles')
      .select('email')
      .eq('user_id', admin_user_id)
      .single();

    if (adminError || !adminUser) {
      throw new Error("Admin user not found");
    }

    // Only allow deployment if target user is the same as admin user
    if (targetUser.email !== adminUser.email) {
      throw new Error("You can only deploy signatures and banners to your own mailbox. To deploy to other users, they must sign in and deploy to themselves.");
    }

    // Get the user's own Exchange connection (not admin connection)
    const { data: userConnections, error: connectionsError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('user_id', target_user_id || admin_user_id)  // Use the target user's connection
      .eq('is_active', true);

    if (connectionsError) {
      throw new Error("Failed to fetch user Exchange connections");
    }

    if (!userConnections || userConnections.length === 0) {
      throw new Error("User has no active Exchange connections. Please connect to Microsoft Exchange first.");
    }

    // Use the user's own connection
    const userConnection = userConnections[0];

    // Get signature if provided
    let signatureHtml = '';
    if (signature_id) {
      console.log('Fetching signature with ID:', signature_id);
      const { data: signature, error: sigError } = await supabase
        .from('email_signatures')
        .select('html_content')
        .eq('id', signature_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (sigError) {
        console.error('Signature fetch error:', sigError);
      }
      
      if (signature) {
        signatureHtml = signature.html_content;
        console.log('Found signature content');
      } else {
        console.log('No signature found for ID:', signature_id);
      }
    }

    // Get banner if provided
    let bannerHtml = '';
    if (banner_id) {
      console.log('Fetching banner with ID:', banner_id);
      const { data: banner, error: banError } = await supabase
        .from('banners')
        .select('html_content')
        .eq('id', banner_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (banError) {
        console.error('Banner fetch error:', banError);
      }
      
      if (banner) {
        bannerHtml = banner.html_content;
        console.log('Found banner content');
      } else {
        console.log('No banner found for ID:', banner_id);
      }
    }

    console.log('Signature HTML length:', signatureHtml.length);
    console.log('Banner HTML length:', bannerHtml.length);

    // Combine signature and banner HTML
    let combinedHtml = '';
    if (bannerHtml && signatureHtml) {
      combinedHtml = `${bannerHtml}<br/><br/>${signatureHtml}`;
    } else if (bannerHtml) {
      combinedHtml = bannerHtml;
    } else if (signatureHtml) {
      combinedHtml = signatureHtml;
    }

    console.log('Combined HTML length:', combinedHtml.length);

    if (!combinedHtml) {
      console.error('No content found. Signature ID:', signature_id, 'Banner ID:', banner_id);
      throw new Error(`No signature or banner content to deploy. Signature ID: ${signature_id}, Banner ID: ${banner_id}`);
    }

    // Check if user token is expired and refresh if needed
    const tokenExpiresAt = new Date(userConnection.token_expires_at);
    const now = new Date();
    
    let accessToken = userConnection.access_token;
    
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
          refresh_token: userConnection.refresh_token,
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
            refresh_token: tokenData.refresh_token || userConnection.refresh_token,
            token_expires_at: newExpiresAt.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('id', userConnection.id);
      } else {
        throw new Error("Failed to refresh user access token");
      }
    }

    // Deploy to user's own Exchange mailbox using their own token
    const deployResult = await deployToTargetUserExchange(
      accessToken, 
      combinedHtml, 
      targetUser.email,
      userConnection.email
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
          admin_email: userConnection.email,
          deployment_success: deployResult.success
        }
      });

    if (!deployResult.success) {
      throw new Error(deployResult.error || "Deployment failed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Signature and banner deployed to ${targetUser.email} using user connection ${userConnection.email}`,
        result: {
          target_email: targetUser.email,
          admin_email: userConnection.email,
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

    // Update only the automatic replies setting (avoid read-only properties)
    const updatedSettings = {
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