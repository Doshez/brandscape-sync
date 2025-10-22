import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const sendGridApiKey = Deno.env.get("SENDGRID_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  recipientEmail: string;
  senderUserId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("Received request body:", JSON.stringify(requestBody));
    
    const { recipientEmail, senderUserId } = requestBody as TestEmailRequest;

    console.log("Sending test email with user assignments:", { recipientEmail, senderUserId });

    if (!recipientEmail || !senderUserId) {
      console.error("Missing required fields:", { recipientEmail, senderUserId });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required fields: recipientEmail and senderUserId are required" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user details using user_id (auth user ID)
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name, id")
      .eq("user_id", senderUserId)
      .single();

    if (userError || !user) {
      console.error("User lookup error:", userError);
      throw new Error("User not found");
    }

    // Fetch user's email assignments using the profile ID (not auth user ID)
    const { data: assignment, error: assignmentError } = await supabase
      .from("user_email_assignments")
      .select("signature_id, id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();
    
    console.log("Assignment lookup:", { profileId: user.id, assignment, error: assignmentError });

    if (assignmentError || !assignment) {
      throw new Error("No active assignment found for this user");
    }

    // Fetch signature
    let signatureHtml = "";
    if (assignment.signature_id) {
      const { data: signature, error: sigError } = await supabase
        .from("email_signatures")
        .select("html_content")
        .eq("id", assignment.signature_id)
        .single();

      if (!sigError && signature) {
        signatureHtml = signature.html_content;
      }
    }

    // Fetch user's banner assignments
    const { data: bannerAssignments, error: bannerError } = await supabase
      .from("user_banner_assignments")
      .select(`
        banner_id,
        banners (
          id,
          html_content,
          click_url,
          name
        )
      `)
      .eq("user_assignment_id", (await supabase
        .from("user_email_assignments")
        .select("id")
        .eq("user_id", senderUserId)
        .eq("is_active", true)
        .single()).data?.id || "");

    let bannerHtml = "";
    if (!bannerError && bannerAssignments && bannerAssignments.length > 0) {
      // Use daily rotation logic to select one banner
      const bannerIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % bannerAssignments.length;
      const selectedBanner = bannerAssignments[bannerIndex];
      if (selectedBanner && selectedBanner.banners) {
        const banner = selectedBanner.banners as any;
        const bannerContent = banner.html_content;
        const clickUrl = banner.click_url;
        
        // Wrap banner in clickable link if click_url exists
        if (clickUrl) {
          bannerHtml = `<a href="${clickUrl}" target="_blank" style="display: block; text-decoration: none;">${bannerContent}</a>`;
        } else {
          bannerHtml = bannerContent;
        }
      }
    }

    // Build email HTML content
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Routing Test Email</h2>
        <p>This is a test email to verify your assigned email signature and banner rotation.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">Test Details:</h3>
          <ul style="color: #6c757d;">
            <li>Sender: ${user.first_name} ${user.last_name} (${user.email})</li>
            <li>Signature Applied: ${signatureHtml ? 'Yes' : 'No'}</li>
            <li>Banner Applied: ${bannerHtml ? 'Yes' : 'No'}</li>
            <li>Sent at: ${new Date().toISOString()}</li>
          </ul>
        </div>

        <p style="color: #495057; line-height: 1.6;">
          This email demonstrates how your actual emails will appear with the assigned signature and banner. 
          The banner rotates daily among your assigned banners.
        </p>
      </div>
    `;

    // Add banner at the top
    if (bannerHtml) {
      htmlContent = `
        <div style="margin-bottom: 20px;">
          ${bannerHtml}
        </div>
        ${htmlContent}
      `;
    }

    // Add signature at the bottom
    if (signatureHtml) {
      htmlContent += `
        <div style="border-top: 1px solid #e9ecef; margin-top: 30px; padding-top: 20px;">
          ${signatureHtml}
        </div>
      `;
    }

    // Use the actual user's email for SendGrid
    const fromEmail = user.email;
    const fromName = `${user.first_name || 'Test'} ${user.last_name || 'User'}`;

    console.log("Sending via SendGrid API:", { 
      from: { email: fromEmail, name: fromName },
      to: recipientEmail,
      subject: `Email Routing Test - ${user.email}`
    });

    // Send email using SendGrid API
    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: recipientEmail }],
          subject: `Email Routing Test - ${user.email}`
        }],
        from: {
          email: fromEmail,
          name: fromName
        },
        reply_to: {
          email: user.email,
          name: fromName
        },
        content: [{
          type: 'text/html',
          value: htmlContent
        }]
      })
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error("SendGrid API error:", errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `SendGrid API error: ${sendGridResponse.status} - ${errorText}`,
        details: {
          message: "Email sending failed. Ensure the sender email is verified in SendGrid at https://app.sendgrid.com/settings/sender_auth"
        }
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log("Email sent successfully via SendGrid");

    return new Response(JSON.stringify({
      success: true,
      message: "Test email sent successfully via SendGrid with user assignments",
      details: {
        signatureApplied: !!signatureHtml,
        bannerApplied: !!bannerHtml,
        totalBanners: bannerAssignments?.length || 0,
        sentVia: 'SendGrid'
      }
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-test-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Failed to send test email"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);