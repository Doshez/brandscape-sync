import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  to: string;
  from: string;
  domain: string;
  includeSignature: boolean;
  includeBanner: boolean;
  signatureContent?: string;
  bannerContent?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      to, 
      from, 
      domain, 
      includeSignature, 
      includeBanner,
      signatureContent,
      bannerContent 
    }: TestEmailRequest = await req.json();

    console.log("Sending test email:", { to, from, domain, includeSignature, includeBanner });

    // Build email HTML content
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">DNS Configuration Test Email</h2>
        <p>This is a test email to verify your DNS configuration and email setup for domain: <strong>${domain}</strong></p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #495057; margin-top: 0;">Test Details:</h3>
          <ul style="color: #6c757d;">
            <li>Domain: ${domain}</li>
            <li>From Email: ${from}</li>
            <li>Signature Included: ${includeSignature ? 'Yes' : 'No'}</li>
            <li>Banner Included: ${includeBanner ? 'Yes' : 'No'}</li>
            <li>Sent at: ${new Date().toISOString()}</li>
          </ul>
        </div>

        <p style="color: #6c757d;">If you received this email, your DNS configuration is working correctly!</p>
      </div>
    `;

    // Add banner if requested
    if (includeBanner && bannerContent) {
      htmlContent = `
        <div style="margin-bottom: 20px;">
          ${bannerContent}
        </div>
        ${htmlContent}
      `;
    }

    // Add signature if requested
    if (includeSignature && signatureContent) {
      htmlContent += `
        <div style="border-top: 1px solid #e9ecef; margin-top: 30px; padding-top: 20px;">
          ${signatureContent}
        </div>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: `DNS Test <${from}>`,
      to: [to],
      subject: `DNS Configuration Test - ${domain}`,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({
      success: true,
      message: "Test email sent successfully",
      emailId: emailResponse.data?.id
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