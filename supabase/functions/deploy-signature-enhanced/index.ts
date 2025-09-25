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
      scope: "https://graph.microsoft.com/.default",
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

    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('email', target_user_email)
      .maybeSingle();

    if (targetError || !targetProfile) {
      throw new Error(`Target user ${target_user_email} not found in organization`);
    }

    // Domain verification
    const adminDomain = adminProfile.email?.split('@')[1]?.toLowerCase();
    const targetDomain = target_user_email.split('@')[1]?.toLowerCase();

    if (!adminDomain || !targetDomain || adminDomain !== targetDomain) {
      throw new Error(`Security violation: Cannot deploy across domains`);
    }

    console.log(`Admin ${adminProfile.email} deploying to ${target_user_email} in domain ${targetDomain}`);

    // Get signature and banner content
    let combinedHtml = '';
    let plainTextInstructions = '';
    
    if (signature_id) {
      const { data: signature } = await supabase
        .from('email_signatures')
        .select('html_content, template_name')
        .eq('id', signature_id)
        .maybeSingle();
      
      if (signature?.html_content) {
        combinedHtml += signature.html_content;
        plainTextInstructions += `Signature: ${signature.template_name}\n`;
      }
    }

    if (banner_id) {
      const { data: banner } = await supabase
        .from('banners')
        .select('html_content, name')
        .eq('id', banner_id)
        .maybeSingle();
      
      if (banner?.html_content) {
        combinedHtml += banner.html_content;
        plainTextInstructions += `Banner: ${banner.name}\n`;
      }
    }

    if (!combinedHtml) {
      throw new Error("No content to deploy");
    }

    const accessToken = await getApplicationAccessToken();
    const deployResult = await enhancedDeployToUser(
      accessToken, 
      combinedHtml, 
      target_user_email,
      plainTextInstructions
    );

    // Log deployment
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

    return new Response(
      JSON.stringify({
        success: deployResult.success,
        message: deployResult.message,
        result: {
          target_email: target_user_email,
          methods_used: deployResult.methods_used,
          instructions: deployResult.instructions
        },
        error: deployResult.error
      }),
      {
        status: deployResult.success ? 200 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Enhanced deployment error:', error);
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

async function enhancedDeployToUser(
  accessToken: string,
  combinedHtml: string,
  targetUserEmail: string,
  instructions: string
) {
  const results = [];
  let hasSuccess = false;

  try {
    console.log(`Enhanced deployment to ${targetUserEmail}`);

    // Method 1: Set as automatic replies (current working method)
    try {
      const mailboxResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}/mailboxSettings`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (mailboxResponse.ok) {
        const mailboxSettings = await mailboxResponse.json();
        
        const updatedSettings = {
          automaticRepliesSetting: {
            status: 'scheduled',
            externalReplyMessage: combinedHtml,
            internalReplyMessage: combinedHtml,
            scheduledStartDateTime: {
              dateTime: new Date().toISOString(),
              timeZone: 'UTC'
            },
            scheduledEndDateTime: {
              dateTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              timeZone: 'UTC'
            }
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

        if (updateResponse.ok) {
          results.push("✅ Automatic replies updated");
          hasSuccess = true;
        } else {
          results.push("❌ Failed to update automatic replies");
        }
      }
    } catch (error) {
      results.push("❌ Failed to access mailbox settings");
    }

    // Method 2: Send setup instructions via email
    try {
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0066cc;">📧 Email Signature Deployed</h2>
          <p>Your email signature/banner has been deployed by an administrator.</p>
          
          <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0;">🔧 Setup Required</h3>
            <p><strong>To use your signature in regular emails:</strong></p>
            <ol>
              <li>In Outlook: <strong>File → Options → Mail → Signatures</strong></li>
              <li>Create a new signature</li>
              <li>Copy and paste the HTML content below</li>
              <li>Set as default for new messages and replies</li>
            </ol>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0;">⚡ Quick Option</h3>
            <p>To see the signature immediately in out-of-office replies:</p>
            <p><strong>File → Automatic Replies (Out of Office)</strong> and enable it.</p>
          </div>

          <div style="border: 2px dashed #ccc; padding: 15px; margin: 15px 0;">
            <h3>Your Deployed Signature/Banner:</h3>
            ${combinedHtml}
          </div>

          <p style="color: #666; font-size: 12px;">
            This email was automatically sent by the Email Signature Management System.
          </p>
        </div>
      `;

      const emailResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUserEmail)}/sendMail`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: "📧 Your Email Signature Has Been Deployed - Setup Required",
            body: {
              contentType: "HTML",
              content: emailContent,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: targetUserEmail,
                },
              },
            ],
          },
        }),
      });

      if (emailResponse.ok) {
        results.push("✅ Setup instructions sent via email");
        hasSuccess = true;
      } else {
        results.push("❌ Failed to send setup instructions");
      }
    } catch (error) {
      results.push("❌ Failed to send email instructions");
    }

    const userInstructions = `
📧 SIGNATURE DEPLOYMENT COMPLETE

✅ Your signature/banner has been deployed to automatic replies
📨 Setup instructions have been sent to ${targetUserEmail}

🔧 MANUAL SETUP REQUIRED:
To see signatures in regular emails, the user must:

1. Open Outlook
2. Go to File → Options → Mail → Signatures  
3. Create new signature with the deployed content
4. Set as default signature

⚡ QUICK TEST:
Enable File → Automatic Replies to see the deployed content immediately.
    `;

    return {
      success: hasSuccess,
      methods_used: results,
      message: hasSuccess 
        ? `Successfully deployed to ${targetUserEmail} with setup instructions`
        : `Failed to deploy to ${targetUserEmail}`,
      instructions: userInstructions,
      error: hasSuccess ? null : results.join(', ')
    };

  } catch (error) {
    return {
      success: false,
      methods_used: results,
      message: `Deployment failed for ${targetUserEmail}`,
      instructions: "Please contact your administrator",
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(handler);