import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeleteUserRequest {
  userId: string;
  profileId: string;
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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      throw new Error("User is not an admin");
    }

    const { userId, profileId }: DeleteUserRequest = await req.json();

    console.log(`Admin ${user.email} deleting user with userId: ${userId}, profileId: ${profileId}`);

    // Delete from auth.users if user has an auth account
    if (userId) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (authDeleteError) {
        console.error("Error deleting from auth.users:", authDeleteError);
        throw new Error(`Failed to delete user from authentication: ${authDeleteError.message}`);
      }
      
      console.log(`Successfully deleted auth user: ${userId}`);
    }

    // Delete from profiles table
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", profileId);

    if (profileDeleteError) {
      console.error("Error deleting from profiles:", profileDeleteError);
      throw new Error(`Failed to delete user profile: ${profileDeleteError.message}`);
    }

    console.log(`Successfully deleted profile: ${profileId}`);

    // Also clean up related records
    if (userId) {
      // Delete from user_roles
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Delete user assignments
      await supabaseAdmin
        .from("user_assignments")
        .delete()
        .eq("user_id", userId);

      // Delete email assignments
      await supabaseAdmin
        .from("user_email_assignments")
        .delete()
        .eq("user_id", userId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "User deleted successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-user function:", error);
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
