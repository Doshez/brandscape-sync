import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
  loginUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (!profile?.is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    // Parse request
    const { email, firstName, lastName, temporaryPassword, loginUrl }: WelcomeEmailRequest = await req.json();

    console.log(`Sending welcome email to: ${email}`);

    // Send welcome email with temporary password
    const emailResponse = await resend.emails.send({
      from: "CIO Africa Email Signature System <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to CIO Africa Email Signature System",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Email Signature System</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to CIO Africa</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Email Signature Management System</p>
          </div>
          
          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hello ${firstName} ${lastName},</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.8;">
              Your account has been created by an administrator. You can now access the Email Signature Management System.
            </p>

            <div style="background: #f3f4f6; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Your Login Credentials</h3>
              <p style="margin: 8px 0; color: #4b5563;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 8px 0; color: #4b5563;"><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${temporaryPassword}</code></p>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>⚠️ Important:</strong> For security reasons, you will be required to change this password upon your first login.
              </p>
            </div>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                Login to Your Account
              </a>
            </div>

            <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid #e5e7eb;">
              <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 15px;">What you can do:</h3>
              <ul style="color: #4b5563; padding-left: 20px; margin: 0;">
                <li style="margin: 8px 0;">Manage your email signature</li>
                <li style="margin: 8px 0;">View assigned banners and campaigns</li>
                <li style="margin: 8px 0;">Update your profile information</li>
                <li style="margin: 8px 0;">Deploy signatures to Exchange Online</li>
              </ul>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have any questions or need assistance, please contact your system administrator.
            </p>
          </div>

          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 5px 0;">© ${new Date().getFullYear()} CIO Africa. All rights reserved.</p>
            <p style="margin: 5px 0;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Welcome email sent successfully",
        emailId: emailResponse.data?.id 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: error.message.includes("Unauthorized") ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
