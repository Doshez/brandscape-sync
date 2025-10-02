import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendGridResponse {
  success: boolean;
  message: string;
  details?: any;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

    if (!SENDGRID_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "SendGrid API key is not configured",
          details: { error: "SENDGRID_API_KEY environment variable not set" },
        } as SendGridResponse),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Testing SendGrid API connection...");

    // Test 1: Verify API key format
    if (!SENDGRID_API_KEY.startsWith("SG.")) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid API key format",
          details: { error: "SendGrid API keys should start with 'SG.'" },
        } as SendGridResponse),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Test 2: Verify API key permissions by checking scopes
    const scopesResponse = await fetch("https://api.sendgrid.com/v3/scopes", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("SendGrid API response status:", scopesResponse.status);

    if (!scopesResponse.ok) {
      const errorText = await scopesResponse.text();
      console.error("SendGrid API error:", errorText);

      return new Response(
        JSON.stringify({
          success: false,
          message: "SendGrid API authentication failed",
          details: {
            status: scopesResponse.status,
            error: errorText,
            hint: "Check if your API key is valid and has not expired",
          },
        } as SendGridResponse),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const scopesData = await scopesResponse.json();
    console.log("SendGrid API scopes:", scopesData);

    const hasMailSend = scopesData.scopes.includes("mail.send");

    if (!hasMailSend) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "API key lacks Mail Send permission",
          details: {
            availableScopes: scopesData.scopes,
            requiredScope: "mail.send",
            hint: "Create a new API key with Mail Send permissions at https://app.sendgrid.com/settings/api_keys",
          },
        } as SendGridResponse),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Test 3: Check account status
    const accountResponse = await fetch("https://api.sendgrid.com/v3/user/account", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    let accountInfo = null;
    if (accountResponse.ok) {
      accountInfo = await accountResponse.json();
      console.log("SendGrid account info:", accountInfo);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SendGrid API is accessible and authenticated",
        details: {
          apiKeyValid: true,
          hasMailSendPermission: true,
          scopes: scopesData.scopes,
          accountType: accountInfo?.type || "unknown",
          accountStatus: accountInfo?.reputation || "unknown",
        },
      } as SendGridResponse),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error testing SendGrid connection:", error);

    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to test SendGrid connection",
        details: {
          error: error.message,
          hint: "Check your network connection and SendGrid service status",
        },
      } as SendGridResponse),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
