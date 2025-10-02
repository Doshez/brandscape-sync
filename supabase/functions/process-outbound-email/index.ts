import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { from, to, subject, html, text }: EmailPayload = await req.json();
    
    console.log(`Processing email from ${from} to ${to}`);
    
    // Extract sender email
    const senderEmail = from.includes("<") 
      ? from.match(/<(.+)>/)?.[1] 
      : from;
    
    if (!senderEmail) {
      throw new Error("Invalid sender email format");
    }
    
    // Look up sender's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("email", senderEmail)
      .maybeSingle();
    
    if (profileError) {
      console.error("Profile lookup error:", profileError);
    }
    
    let finalHtml = html;
    
    if (profile) {
      console.log(`Found profile for ${senderEmail}:`, profile.id);
      
      // Get active assignment for this user
      const { data: assignment } = await supabase
        .from("user_email_assignments")
        .select(`
          *,
          email_signatures (
            html_content
          )
        `)
        .eq("user_id", profile.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (assignment?.email_signatures) {
        console.log("Found signature assignment");
        const signatureHtml = assignment.email_signatures.html_content;
        
        // Append signature to email body
        finalHtml = `${html}\n\n${signatureHtml}`;
      }
      
      // Get banner assignments
      const { data: bannerAssignments } = await supabase
        .from("user_banner_assignments")
        .select(`
          banner_id,
          display_order,
          banners (
            html_content,
            click_url
          )
        `)
        .eq("user_assignment_id", assignment?.id || "")
        .order("display_order", { ascending: true });
      
      if (bannerAssignments && bannerAssignments.length > 0) {
        console.log(`Found ${bannerAssignments.length} banner(s)`);
        
        // Prepend banners to email body
        const bannersHtml = bannerAssignments
          .map((ba: any) => {
            const banner = ba.banners;
            if (banner.click_url) {
              return `<a href="${banner.click_url}" target="_blank">${banner.html_content}</a>`;
            }
            return banner.html_content;
          })
          .join("\n");
        
        finalHtml = `${bannersHtml}\n\n${finalHtml}`;
      }
    } else {
      console.log(`No profile found for ${senderEmail}, sending without modifications`);
    }
    
    // Send email via SendGrid
    console.log("Sending email via SendGrid API");
    
    const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: { 
          email: senderEmail,
          name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : senderEmail
        },
        subject: subject,
        content: [
          { type: "text/html", value: finalHtml },
          ...(text ? [{ type: "text/plain", value: text }] : []),
        ],
      }),
    });
    
    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error("SendGrid API error:", errorText);
      throw new Error(`SendGrid API error: ${errorText}`);
    }
    
    console.log("Email sent successfully");
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email processed and sent with signature/banner" 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error: any) {
    console.error("Error processing email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
