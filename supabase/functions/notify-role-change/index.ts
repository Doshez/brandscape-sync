import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoleChangeRequest {
  email: string;
  firstName: string;
  lastName: string;
  isPromoted: boolean;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (rolesError || !roles) {
      throw new Error("User is not an admin");
    }

    const { email, firstName, lastName, isPromoted, userId }: RoleChangeRequest = await req.json();

    console.log(`Admin ${user.email} changed role for: ${email}, promoted: ${isPromoted}`);

    let temporaryPassword = "";

    // If promoting to admin, generate temporary password and update user auth
    if (isPromoted) {
      // Generate a temporary password
      temporaryPassword = `TempAdmin${Math.random().toString(36).slice(-8)}!${Date.now().toString().slice(-4)}`;
      
      // Update user's password using admin client
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: temporaryPassword }
      );

      if (passwordError) {
        console.error("Error updating user password:", passwordError);
        throw new Error("Failed to set temporary password");
      }

      console.log(`Temporary password set for user: ${email}`);
    }

    // Send notification email
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const loginUrl = "https://emailsigdash.cioafrica.co/";

    const emailHtml = isPromoted ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Congratulations! You've Been Promoted to Admin</h1>
        <p>Hello ${firstName},</p>
        <p>Great news! You have been promoted to administrator in the CIO Africa Email Signature Management system.</p>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h2 style="color: #333; margin-top: 0;">Your Login Credentials</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #f4f4f4; padding: 4px 8px; border-radius: 3px; font-size: 14px;">${temporaryPassword}</code></p>
          <p style="color: #856404; margin-top: 15px;">
            <strong>⚠️ Important:</strong> You must change this password immediately after logging in for security purposes.
          </p>
        </div>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Your New Privileges</h2>
          <p>As an admin, you can now:</p>
          <ul>
            <li>Manage email signatures and banners</li>
            <li>Invite and manage users</li>
            <li>Deploy signatures and banners to users</li>
            <li>View analytics and reports</li>
          </ul>
        </div>

        <div style="margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Login to Dashboard
          </a>
        </div>

        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${loginUrl}</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          If you have any questions about your new role, please contact your system administrator.
        </p>
      </div>
    ` : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Role Update Notification</h1>
        <p>Hello ${firstName},</p>
        <p>Your administrator privileges in the CIO Africa Email Signature Management system have been removed.</p>
        
        <p>You can still access the system with your regular user account.</p>

        <div style="margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Login to Dashboard
          </a>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          If you have any questions, please contact your system administrator.
        </p>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "CIO Africa <onboarding@resend.dev>",
      to: [email],
      subject: isPromoted ? "You've Been Promoted to Admin - CIO Africa" : "Role Update - CIO Africa",
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to send notification email"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Role change notification sent to: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Role change notification sent successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-role-change function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
