import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

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
    const { recipientEmail, senderUserId }: TestEmailRequest = await req.json();

    console.log("Sending test email with user assignments:", { recipientEmail, senderUserId });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user details
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", senderUserId)
      .single();

    if (userError || !user) {
      throw new Error("User not found");
    }

    // Fetch user's email assignments
    const { data: assignment, error: assignmentError } = await supabase
      .from("user_email_assignments")
      .select("signature_id")
      .eq("user_id", senderUserId)
      .eq("is_active", true)
      .single();

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

    // Fetch verified domain to use for sending
    const { data: verifiedDomain } = await supabase
      .from("domains")
      .select("domain_name")
      .eq("is_verified", true)
      .limit(1)
      .single();

    const senderName = `${user.first_name || 'Test'} ${user.last_name || 'User'}`;
    const senderEmail = verifiedDomain 
      ? `noreply@${verifiedDomain.domain_name}`
      : `test@dx5ve.com`;

    console.log("Sending via SendGrid API:", {
      from: { email: senderEmail, name: senderName },
      to: recipientEmail,
      subject: `Email Routing Test - ${user.email}`
    });

    // Send via SendGrid API
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      throw new Error("SendGrid API key not configured");
    }

    const sendGridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: recipientEmail }],
            subject: `Email Routing Test - ${user.email}`,
          }
        ],
        from: {
          email: senderEmail,
          name: senderName
        },
        reply_to: {
          email: user.email,
          name: senderName
        },
        content: [
          {
            type: "text/html",
            value: htmlContent
          }
        ]
      })
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error("SendGrid API error:", errorText);
      throw new Error(`SendGrid API error: ${sendGridResponse.status} - ${errorText}`);
    }

    console.log("Email sent successfully via SendGrid API");

    return new Response(JSON.stringify({
      success: true,
      message: "Test email sent successfully via SendGrid",
      details: {
        signatureApplied: !!signatureHtml,
        bannerApplied: !!bannerHtml,
        totalBanners: bannerAssignments?.length || 0,
        provider: "SendGrid API",
        from: `${senderName} <${senderEmail}>`,
        to: recipientEmail
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