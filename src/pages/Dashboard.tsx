import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from "@supabase/supabase-js";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { EnhancedSignatureManager } from "@/components/dashboard/EnhancedSignatureManager";
import { EnhancedBannerManager } from "@/components/dashboard/EnhancedBannerManager";
import { AnalyticsReports } from "@/components/dashboard/AnalyticsReports";
import { AutomatedTransportRules } from "@/components/dashboard/AutomatedTransportRules";
import { CompanySettings } from "@/components/dashboard/CompanySettings";
import { UserManager } from "@/components/dashboard/UserManager";
import { UserAssignmentManager } from "@/components/dashboard/UserAssignmentManager";
import { AdminUserManagement } from "@/components/dashboard/AdminUserManagement";

type DashboardView = "home" | "signatures" | "banners" | "analytics" | "settings" | "users" | "assignments" | "auto-transport-rules";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeView, setActiveView] = useState<DashboardView>("home");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      // If no profile exists, create one
      if (!data) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              user_id: userId,
              email: userData.user.email,
              first_name: userData.user.user_metadata?.first_name || '',
              last_name: userData.user.user_metadata?.last_name || '',
              department: userData.user.user_metadata?.department || ''
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creating profile:", createError);
            return;
          }
          setProfile(newProfile);
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      toast({
        title: "Error signing out",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return null;
  }

  const renderActiveView = () => {
    switch (activeView) {
      case "home":
        return (
          <DashboardHome 
            profile={profile} 
            onNavigateToAnalytics={() => setActiveView("analytics")}
            onNavigateToSignatures={() => setActiveView("signatures")}
            onNavigateToBanners={() => setActiveView("banners")}
          />
        );
      case "signatures":
        return <EnhancedSignatureManager profile={profile} />;
      case "banners":
        return <EnhancedBannerManager profile={profile} />;
      case "analytics":
        return <AnalyticsReports profile={profile} />;
      case "auto-transport-rules":
        return <AutomatedTransportRules profile={profile} />;
      case "settings":
        return <CompanySettings profile={profile} />;
      case "users":
        return <AdminUserManagement profile={profile} />;
      case "assignments":
        return <UserAssignmentManager profile={profile} />;
      default:
        return <DashboardHome profile={profile} />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView}
        profile={profile}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader 
          user={user} 
          profile={profile}
          onSignOut={handleSignOut} 
        />
        
        <main className="flex-1 overflow-auto p-6">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;