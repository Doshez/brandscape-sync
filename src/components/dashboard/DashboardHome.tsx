import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Image, BarChart3, Users, TrendingUp, Clock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailRoutingPanel } from "./EmailRoutingPanel";

interface DashboardHomeProps {
  profile: any;
  onNavigateToAnalytics?: () => void;
}

interface DashboardStats {
  totalSignatures: number;
  activeBanners: number;
  totalUsers: number;
  clicksThisMonth: number;
}

export const DashboardHome = ({ profile, onNavigateToAnalytics }: DashboardHomeProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalSignatures: 0,
    activeBanners: 0,
    totalUsers: 0,
    clicksThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Fetch signatures count
      const { count: signaturesCount } = await supabase
        .from("email_signatures")
        .select("*", { count: "exact", head: true });

      // Fetch active banners count
      const { count: bannersCount } = await supabase
        .from("banners")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      // Fetch users count (if admin)
      let usersCount = 0;
      if (profile?.is_admin) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id");
        
        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        } else {
          usersCount = profilesData?.length || 0;
        }
      }

      // Fetch clicks this month from banners table (if admin)
      let clicksThisMonth = 0;
      if (profile?.is_admin) {
        const { data: bannersData, error: bannersError } = await supabase
          .from("banners")
          .select("current_clicks");
        
        if (bannersError) {
          console.error("Error fetching banner clicks:", bannersError);
        } else {
          clicksThisMonth = bannersData?.reduce((sum, banner) => sum + (banner.current_clicks || 0), 0) || 0;
        }
      }

      setStats({
        totalSignatures: signaturesCount || 0,
        activeBanners: bannersCount || 0,
        totalUsers: usersCount,
        clicksThisMonth,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Email Signatures",
      value: stats.totalSignatures,
      description: "Total signatures created",
      icon: FileText,
      color: "text-blue-600",
    },
    {
      title: "Active Banners",
      value: stats.activeBanners,
      description: "Currently running campaigns",
      icon: Image,
      color: "text-green-600",
    },
    ...(profile?.is_admin ? [
      {
        title: "Total Users",
        value: stats.totalUsers,
        description: "Registered employees",
        icon: Users,
        color: "text-purple-600",
      },
      {
        title: "Clicks This Month",
        value: stats.clicksThisMonth,
        description: "Banner engagements",
        icon: TrendingUp,
        color: "text-orange-600",
      },
    ] : []),
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Overview</h3>
        <p className="text-muted-foreground">
          Your email signature management dashboard
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isClickable = card.title === "Clicks This Month" && onNavigateToAnalytics;
          return (
            <Card 
              key={card.title}
              className={isClickable ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}
              onClick={isClickable ? onNavigateToAnalytics : undefined}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                  {isClickable && " • Click to view details"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Email Configuration</CardTitle>
            <CardDescription>
              Configure email routing and domain verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                onClick={() => setIsEmailPanelOpen(true)}
                className="w-full justify-start"
                variant="outline"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Routing & Domain Setup
              </Button>
              <p className="text-xs text-muted-foreground">
                Set up SMTP settings and verify your domain for email authentication
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest changes to signatures and banners
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Signature updated</p>
                  <p className="text-xs text-muted-foreground">Marketing Department - 2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New banner campaign</p>
                  <p className="text-xs text-muted-foreground">Q4 Product Launch - 1 day ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">User registered</p>
                  <p className="text-xs text-muted-foreground">Sales Team - 2 days ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium">Create New Signature</span>
                </div>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              
              {profile?.is_admin && (
                <>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Image className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium">Upload Banner</span>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="h-5 w-5 text-orange-600" />
                      <span className="text-sm font-medium">View Analytics</span>
                    </div>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <EmailRoutingPanel 
        isOpen={isEmailPanelOpen}
        onClose={() => setIsEmailPanelOpen(false)}
        profile={profile}
      />
    </div>
  );
};