import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PromoteUserRequest {
  userId: string;
  temporaryPassword: string;
  createAuthAccount?: boolean;
  userEmail?: string;
  userMetadata?: {
    first_name?: string;
    last_name?: string;
    department?: string;
    job_title?: string;
  };
  adminUserId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify requesting user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: requestingProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (!requestingProfile?.is_admin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const { 
      userId, 
      temporaryPassword, 
      createAuthAccount, 
      userEmail,
      userMetadata,
      adminUserId 
    }: PromoteUserRequest = await req.json();

    console.log(`Processing promotion request for user: ${userId}`);

    let authUserId = userId;

    // Create auth account if needed
    if (createAuthAccount && userEmail) {
      console.log(`Creating auth account for: ${userEmail}`);
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          ...userMetadata,
          requires_password_change: true,
        },
      });

      if (authError) {
        console.error("Error creating auth account:", authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Failed to create auth account");
      }

      authUserId = authData.user.id;
      console.log(`Auth account created with ID: ${authUserId}`);

      // Link auth account to profile
      const { error: linkError } = await supabase
        .from("profiles")
        .update({ user_id: authUserId })
        .eq("id", userId);

      if (linkError) {
        console.error("Error linking profile:", linkError);
        throw linkError;
      }
    } else if (userId) {
      // Update existing user's password
      console.log(`Updating password for existing user: ${userId}`);
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          password: temporaryPassword,
          user_metadata: {
            requires_password_change: true
          }
        }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        throw updateError;
      }
    }

    // Update profile to admin
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_admin: true })
      .eq(createAuthAccount ? "id" : "user_id", createAuthAccount ? userId : authUserId);

    if (profileError) {
      console.error("Error updating profile:", profileError);
      throw profileError;
    }

    // Add admin role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: authUserId,
        role: "admin",
        created_by: adminUserId,
      });

    if (roleError && roleError.code !== '23505') {
      console.error("Error adding admin role:", roleError);
    }

    console.log(`Successfully promoted user to admin`);

    return new Response(
      JSON.stringify({ 
        success: true,
        authUserId: authUserId
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in promote-user-to-admin function:", error);
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
