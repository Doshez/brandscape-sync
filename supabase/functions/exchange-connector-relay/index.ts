import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Exchange Connector Relay: Received request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the incoming email from Exchange
    const contentType = req.headers.get("content-type") || "";
    let emailData: EmailPayload;

    if (contentType.includes("application/json")) {
      emailData = await req.json();
    } else if (contentType.includes("multipart/form-data")) {
      // Handle form data from Exchange
      const formData = await req.formData();
      emailData = parseFormDataEmail(formData);
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    console.log("Processing email from:", emailData.from, "to:", emailData.to);

    // Extract sender email
    const senderEmail = extractEmail(emailData.from);
    
    // Look up user's signature and banner assignment
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", senderEmail)
      .single();

    if (!profile) {
      console.log("No profile found for sender:", senderEmail);
      // Forward without modification
      return await forwardEmail(emailData, sendgridApiKey);
    }

    // Get active assignment with signature and banners
    const { data: assignment } = await supabase
      .from("user_email_assignments")
      .select(`
        *,
        email_signatures (
          html_content
        ),
        user_banner_assignments (
          banner_id,
          display_order,
          banners (
            html_content,
            is_active
          )
        )
      `)
      .eq("user_id", profile.user_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let modifiedHtml = emailData.html || "";
    let modifiedText = emailData.text || "";

    // Add signature
    if (assignment?.email_signatures?.html_content) {
      const signatureHtml = assignment.email_signatures.html_content;
      modifiedHtml = modifiedHtml 
        ? `${modifiedHtml}<br/><br/>${signatureHtml}`
        : signatureHtml;
      
      // Add text version of signature if text content exists
      if (modifiedText) {
        modifiedText = `${modifiedText}\n\n---\n${stripHtml(signatureHtml)}`;
      }
    }

    // Add banners (prepend to email body)
    if (assignment?.user_banner_assignments) {
      const activeBanners = assignment.user_banner_assignments
        .filter((ba: any) => ba.banners?.is_active)
        .sort((a: any, b: any) => a.display_order - b.display_order);

      for (const bannerAssignment of activeBanners) {
        const bannerHtml = bannerAssignment.banners.html_content;
        
        // Generate tracking ID for this email
        const trackingId = crypto.randomUUID();
        
        // Create tracking session
        await supabase.from("email_tracking_sessions").insert({
          tracking_id: trackingId,
          sender_email: senderEmail,
          recipient_email: emailData.to[0],
          banner_id: bannerAssignment.banner_id,
        });

        // Inject tracking into banner HTML
        const trackedBannerHtml = injectTracking(bannerHtml, trackingId);
        
        modifiedHtml = `${trackedBannerHtml}<br/>${modifiedHtml}`;
        
        if (modifiedText) {
          modifiedText = `${stripHtml(bannerHtml)}\n\n${modifiedText}`;
        }

        // Log banner view event
        await supabase.from("analytics_events").insert({
          event_type: "banner_view",
          banner_id: bannerAssignment.banner_id,
          email_recipient: emailData.to[0],
          user_id: profile.user_id,
        });
      }
    }

    // Forward the modified email
    const result = await forwardEmail(
      {
        ...emailData,
        html: modifiedHtml,
        text: modifiedText,
      },
      sendgridApiKey
    );

    return result;
  } catch (error: any) {
    console.error("Exchange Connector Relay Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

function parseFormDataEmail(formData: FormData): EmailPayload {
  return {
    from: formData.get("from") as string,
    to: (formData.get("to") as string)?.split(",").map(e => e.trim()) || [],
    cc: (formData.get("cc") as string)?.split(",").map(e => e.trim()).filter(Boolean),
    bcc: (formData.get("bcc") as string)?.split(",").map(e => e.trim()).filter(Boolean),
    subject: formData.get("subject") as string,
    html: formData.get("html") as string,
    text: formData.get("text") as string,
  };
}

function extractEmail(emailString: string): string {
  const match = emailString.match(/<(.+?)>/) || emailString.match(/([^\s]+@[^\s]+)/);
  return match ? match[1] : emailString;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function injectTracking(bannerHtml: string, trackingId: string): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)/)?.[1];
  
  if (!projectRef) return bannerHtml;

  const viewTrackingPixel = `<img src="https://${projectRef}.supabase.co/functions/v1/track-banner-view?tid=${trackingId}" width="1" height="1" style="display:none" />`;
  
  // Wrap all links with click tracking
  const trackedHtml = bannerHtml.replace(
    /href="([^"]+)"/g,
    `href="https://${projectRef}.supabase.co/functions/v1/track-banner-click?tid=${trackingId}&url=$1"`
  );
  
  return `${trackedHtml}${viewTrackingPixel}`;
}

async function forwardEmail(
  emailData: EmailPayload,
  sendgridApiKey?: string
): Promise<Response> {
  if (!sendgridApiKey) {
    throw new Error("SendGrid API key not configured");
  }

  console.log("Forwarding email via SendGrid to:", emailData.to);

  const sendgridPayload = {
    personalizations: [
      {
        to: emailData.to.map(email => ({ email })),
        cc: emailData.cc?.map(email => ({ email })),
        bcc: emailData.bcc?.map(email => ({ email })),
      },
    ],
    from: { email: extractEmail(emailData.from) },
    subject: emailData.subject,
    content: [
      ...(emailData.text ? [{ type: "text/plain", value: emailData.text }] : []),
      ...(emailData.html ? [{ type: "text/html", value: emailData.html }] : []),
    ],
    attachments: emailData.attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      type: att.contentType,
    })),
  };

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sendgridPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("SendGrid error:", errorText);
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }

  console.log("Email forwarded successfully");
  
  return new Response(
    JSON.stringify({ success: true, message: "Email processed and forwarded" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
}

serve(handler);
