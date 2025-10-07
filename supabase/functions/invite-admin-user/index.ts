import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
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

    const { email, firstName, lastName, temporaryPassword }: InviteRequest = await req.json();

    console.log(`Admin ${user.email} inviting user: ${email}`);

    // Create the user with temporary password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    console.log(`User created: ${newUser.user?.id}`);

    // Add admin role to the new user
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user!.id,
        role: "admin",
        created_by: user.id,
      });

    if (roleError) {
      console.error("Error adding admin role:", roleError);
      throw new Error(`Failed to assign admin role: ${roleError.message}`);
    }

    console.log(`Admin role assigned to user: ${newUser.user?.id}`);

    // Send welcome email with temporary password
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const loginUrl = "https://emailsigdash.cioafrica.co/auth";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome to CIO Africa Email Signature Management</h1>
        <p>Hello ${firstName},</p>
        <p>You have been granted admin access to the CIO Africa Email Signature Management system.</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Your Login Credentials</h2>
          <p><strong>Username (Email):</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
        </div>

        <p style="color: #d32f2f; font-weight: bold;">⚠️ Important: Please change your password immediately after logging in.</p>

        <div style="margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Click here to login and change your password
          </a>
        </div>

        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #666; word-break: break-all;">${loginUrl}</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          If you did not expect this invitation, please ignore this email or contact your administrator.
        </p>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "CIO Africa <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to CIO Africa Email Signature Management",
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      // Don't throw error here - user is created, just email failed
      return new Response(
        JSON.stringify({ 
          success: true, 
          userId: newUser.user!.id,
          warning: "User created but email notification failed to send"
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Welcome email sent to: ${email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUser.user!.id,
        message: "Admin user invited successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in invite-admin-user function:", error);
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
