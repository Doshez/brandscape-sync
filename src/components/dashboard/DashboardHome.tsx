import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Image, BarChart3, Users, TrendingUp, Clock, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailRoutingPanel } from "./EmailRoutingPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DashboardHomeProps {
  profile: any;
  onNavigateToAnalytics?: () => void;
  onNavigateToSignatures?: () => void;
  onNavigateToBanners?: () => void;
}

interface DashboardStats {
  totalSignatures: number;
  activeBanners: number;
  totalUsers: number;
  clicksThisMonth: number;
  topBanners: Array<{ id: string; name: string; current_clicks: number }>;
}

export const DashboardHome = ({ profile, onNavigateToAnalytics, onNavigateToSignatures, onNavigateToBanners }: DashboardHomeProps) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalSignatures: 0,
    activeBanners: 0,
    totalUsers: 0,
    clicksThisMonth: 0,
    topBanners: [],
  });
  const [loading, setLoading] = useState(true);
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);

  useEffect(() => {
    fetchDashboardStats();

    // Set up real-time subscription for banner clicks
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'analytics_events',
          filter: 'event_type=eq.click'
        },
        () => {
          // Refresh stats when click events are recorded
          fetchDashboardStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'banners'
        },
        () => {
          // Refresh stats when banners are updated (e.g., current_clicks)
          fetchDashboardStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const fetchDashboardStats = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Get active banner IDs first if admin
      let activeBannerIds: string[] = [];
      if (profile?.is_admin) {
        const { data: activeBanners } = await supabase
          .from("banners")
          .select("id")
          .eq("is_active", true);
        activeBannerIds = activeBanners?.map(b => b.id) || [];
      }

      // Run all queries in parallel for better performance
      const [
        { count: signaturesCount },
        { count: bannersCount },
        profilesData,
        clickData,
        topBannersData
      ] = await Promise.all([
        supabase.from("email_signatures").select("*", { count: "exact", head: true }),
        supabase.from("banners").select("*", { count: "exact", head: true }).eq("is_active", true),
        profile?.is_admin 
          ? supabase.from("profiles").select("id")
          : Promise.resolve({ data: null, error: null }),
        profile?.is_admin && activeBannerIds.length > 0
          ? supabase
              .from("analytics_events")
              .select("*", { count: "exact", head: true })
              .eq("event_type", "click")
              .in("banner_id", activeBannerIds)
              .gte("timestamp", startOfMonth.toISOString())
          : Promise.resolve({ count: null }),
        profile?.is_admin
          ? supabase.from("banners").select("id, name, current_clicks").eq("is_active", true).order("current_clicks", { ascending: false }).limit(5)
          : Promise.resolve({ data: null })
      ]);

      setStats({
        totalSignatures: signaturesCount || 0,
        activeBanners: bannersCount || 0,
        totalUsers: profilesData.data?.length || 0,
        clicksThisMonth: clickData.count || 0,
        topBanners: topBannersData.data || [],
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
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">User registered</p>
                  <p className="text-xs text-muted-foreground">Sales Team - 2 days ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {profile?.is_admin && stats.topBanners.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Banners</CardTitle>
              <CardDescription>
                Banners with the most clicks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-4">
                  {stats.topBanners.map((banner, index) => (
                    <div key={banner.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{banner.name}</p>
                          <p className="text-xs text-muted-foreground">{banner.current_clicks} total clicks</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                        <span className="font-bold text-lg">{banner.current_clicks}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={onNavigateToSignatures}
              >
                <FileText className="h-5 w-5 text-blue-600 mr-3" />
                <span className="text-sm font-medium">Create New Signature</span>
              </Button>
              
              {profile?.is_admin && (
                <>
                  <Button 
                    variant="outline"
                    className="w-full justify-start"
                    onClick={onNavigateToBanners}
                  >
                    <Image className="h-5 w-5 text-green-600 mr-3" />
                    <span className="text-sm font-medium">Upload Banner</span>
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="w-full justify-start"
                    onClick={onNavigateToAnalytics}
                  >
                    <BarChart3 className="h-5 w-5 text-orange-600 mr-3" />
                    <span className="text-sm font-medium">View Analytics</span>
                  </Button>
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