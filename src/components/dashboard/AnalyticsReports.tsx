import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, TrendingUp, Users, MousePointer, Eye, Calendar, Download, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalyticsReportsProps {
  profile: any;
}

interface BannerAnalytics {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  current_clicks: number;
  max_clicks: number | null;
  total_events: number;
  click_count: number;
  impression_count: number;
  click_through_rate: number;
}

interface AnalyticsEvent {
  id: string;
  event_type: string;
  banner_id: string | null;
  campaign_id: string | null;
  timestamp: string;
  user_agent: string | null;
  ip_address: unknown;
  email_recipient: string | null;
  metadata: any;
}


export const AnalyticsReports = ({ profile }: AnalyticsReportsProps) => {
  const [bannerAnalytics, setBannerAnalytics] = useState<BannerAnalytics[]>([]);
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7d");
  const [selectedMetric, setSelectedMetric] = useState("clicks");
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.is_admin) {
      fetchAnalytics();
    }
  }, [profile, dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (dateRange) {
        case "1d":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      const [analyticsResult, eventsResult] = await Promise.all([
        supabase.from("banner_analytics").select("*"),
        supabase
          .from("analytics_events")
          .select("*")
          .gte("timestamp", startDate.toISOString())
          .lte("timestamp", endDate.toISOString())
          .order("timestamp", { ascending: false })
          .limit(100)
      ]);

      if (analyticsResult.error) throw analyticsResult.error;
      if (eventsResult.error) throw eventsResult.error;

      setBannerAnalytics(analyticsResult.data || []);
      setRecentEvents(eventsResult.data || []);

    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async () => {
    try {
      const csvContent = [
        ["Banner Name", "Status", "Total Clicks", "Impressions", "CTR", "Created Date"].join(","),
        ...bannerAnalytics.map(banner => [
          banner.name,
          banner.is_active ? "Active" : "Inactive",
          banner.click_count,
          banner.impression_count,
          banner.click_through_rate + "%",
          new Date(banner.created_at).toLocaleDateString()
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `banner-analytics-${dateRange}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: "Analytics data has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data",
        variant: "destructive",
      });
    }
  };

  const getTotalStats = () => {
    return {
      totalClicks: bannerAnalytics.reduce((sum, banner) => sum + (banner.current_clicks || 0), 0),
      totalImpressions: bannerAnalytics.reduce((sum, banner) => sum + banner.impression_count, 0),
      averageCTR: bannerAnalytics.length > 0 
        ? (bannerAnalytics.reduce((sum, banner) => sum + banner.click_through_rate, 0) / bannerAnalytics.length).toFixed(2)
        : "0.00",
      activeBanners: bannerAnalytics.filter(banner => banner.is_active).length,
    };
  };

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-muted-foreground">Only administrators can view analytics.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Analytics & Reports</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalStats = getTotalStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Analytics & Reports</h3>
          <p className="text-muted-foreground">
            Track banner performance and user engagement
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button variant="outline" onClick={exportAnalytics}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all active banners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalImpressions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Banner views recorded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average CTR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.averageCTR}%</div>
            <p className="text-xs text-muted-foreground">
              Click-through rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Banners</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.activeBanners}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="banners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="banners">Banner Performance</TabsTrigger>
          <TabsTrigger value="events">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="banners" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Banner Performance</CardTitle>
              <CardDescription>
                Individual banner statistics and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bannerAnalytics.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No banner data available for the selected period
                  </p>
                ) : (
                  bannerAnalytics.map((banner) => (
                    <div key={banner.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="font-medium flex items-center space-x-2">
                            <span>{banner.name}</span>
                            {banner.is_active ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(banner.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium text-lg">{banner.current_clicks}</div>
                          <div className="text-muted-foreground">Total Clicks</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{banner.click_count}</div>
                          <div className="text-muted-foreground">Period Clicks</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{banner.impression_count}</div>
                          <div className="text-muted-foreground">Views</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{banner.click_through_rate.toFixed(2)}%</div>
                          <div className="text-muted-foreground">CTR</div>
                        </div>
                        {banner.max_clicks && (
                          <div className="text-center">
                            <div className="font-medium">
                              {banner.current_clicks}/{banner.max_clicks}
                            </div>
                            <div className="text-muted-foreground">Limit</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest banner interactions and events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentEvents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No recent events recorded
                  </p>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        {event.event_type === "click" ? (
                          <MousePointer className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-green-500" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {event.event_type === "click" ? "Banner Clicked" : "Banner Viewed"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.email_recipient && `by ${event.email_recipient}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center space-x-2">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};