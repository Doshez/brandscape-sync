import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminDeployRequest {
  target_user_email: string;
  signature_id?: string;
  banner_id?: string;
  admin_user_id: string;
}

// This would use Client Credentials flow instead of Authorization Code flow
async function getApplicationAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("MICROSOFT_TENANT_ID");
  
  if (!tenantId) {
    throw new Error("Microsoft Tenant ID not configured. Please add MICROSOFT_TENANT_ID to Supabase secrets.");
  }

  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: Deno.env.get("MICROSOFT_CLIENT_ID")!,
      client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET")!,
      scope: "https://graph.microsoft.com/.default", // Application permission scope
      grant_type: "client_credentials"
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}));
    console.error('Token request failed:', errorData);
    throw new Error(`Failed to get application access token: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { target_user_email, signature_id, banner_id, admin_user_id }: AdminDeployRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin privileges and domain restrictions
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('is_admin, email, department')
      .eq('user_id', admin_user_id)
      .maybeSingle();

    if (adminError || !adminProfile?.is_admin) {
      throw new Error("Insufficient privileges - admin access required");
    }

    // Enhanced security: Verify target user exists and domain matching
    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('email', target_user_email)
      .maybeSingle();

    if (targetError || !targetProfile) {
      throw new Error(`Target user ${target_user_email} not found in organization`);
    }

    // Domain verification for security
    const adminDomain = adminProfile.email?.split('@')[1]?.toLowerCase();
    const targetDomain = target_user_email.split('@')[1]?.toLowerCase();

    if (!adminDomain || !targetDomain || adminDomain !== targetDomain) {
      throw new Error(`Security violation: Cannot deploy across domains. Admin domain: ${adminDomain}, Target domain: ${targetDomain}`);
    }

    console.log(`Admin ${adminProfile.email} deploying to ${target_user_email} in domain ${targetDomain}`);

    // Get signature and banner content (same as current implementation)
    let combinedHtml = '';
    
    if (signature_id) {
      const { data: signature } = await supabase
        .from('email_signatures')
        .select('html_content')
        .eq('id', signature_id)
        .maybeSingle();
      
      if (signature?.html_content) {
        combinedHtml += signature.html_content;
      }
    }

    if (banner_id) {
      const { data: banner } = await supabase
        .from('banners')
        .select('html_content')
        .eq('id', banner_id)
        .maybeSingle();
      
      if (banner?.html_content) {
        combinedHtml += banner.html_content;
      }
    }

    if (!combinedHtml) {
      throw new Error("No content to deploy");
    }

    // Get application-level access token
    const accessToken = await getApplicationAccessToken();

    // Deploy to target user using application permissions
    const deployResult = await deployToUserWithAppPermissions(
      accessToken, 
      combinedHtml, 
      target_user_email
    );

    // Log deployment in history table
    await supabase
      .from('deployment_history')
      .insert({
        admin_user_id,
        target_user_email,
        signature_id: signature_id || null,
        banner_id: banner_id || null,
        deployment_status: deployResult.success ? 'success' : 'failed',
        error_message: deployResult.error || null
      });

    // Log the admin deployment analytics
    await supabase
      .from('analytics_events')
      .insert({
        event_type: 'admin_signature_banner_deployed',
        user_id: admin_user_id,
        email_recipient: target_user_email,
        metadata: {
          signature_id,
          banner_id,
          admin_email: adminProfile.email,
          target_email: target_user_email,
          deployment_success: deployResult.success
        }
      });

    return new Response(
      JSON.stringify({
        success: deployResult.success,
        message: `Admin deployed to ${target_user_email}`,
        error: deployResult.error
      }),
      {
        status: deployResult.success ? 200 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Admin deployment error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

async function deployToUserWithAppPermissions(
  accessToken: string,
  combinedHtml: string,
  targetUserEmail: string
) {
  try {
    // With application permissions, you can directly access any user's mailbox
    const mailboxResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}/mailboxSettings`, {
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

    // Update only the automatic replies setting
    const updatedSettings = {
      automaticRepliesSetting: {
        ...mailboxSettings.automaticRepliesSetting,
        externalReplyMessage: combinedHtml,
        internalReplyMessage: combinedHtml,
      },
    };

    const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}/mailboxSettings`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatedSettings),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update mailbox: ${error.error?.message}`);
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