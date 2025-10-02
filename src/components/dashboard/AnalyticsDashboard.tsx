import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, TrendingUp, MousePointer, Eye, Calendar } from "lucide-react";

interface AnalyticsDashboardProps {
  profile: any;
}

interface AnalyticsData {
  totalClicks: number;
  totalViews: number;
  clickThroughRate: number;
  topBanners: Array<{ banner_name: string; clicks: number; banner_id: string }>;
  recentActivity: Array<{ event_type: string; timestamp: string; banner_id: string }>;
}

export const AnalyticsDashboard = ({ profile }: AnalyticsDashboardProps) => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalClicks: 0,
    totalViews: 0,
    clickThroughRate: 0,
    topBanners: [],
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7d");

  useEffect(() => {
    if (profile?.is_admin) {
      fetchAnalytics();
    }
  }, [profile, dateRange]);

  const fetchAnalytics = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case "24h":
          startDate.setHours(startDate.getHours() - 24);
          break;
        case "7d":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      // Fetch click count from analytics_events with date filtering
      const { count: clickCount } = await supabase
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "click")
        .gte("timestamp", startDate.toISOString());

      // Fetch view count
      const { count: viewCount } = await supabase
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "view")
        .gte("timestamp", startDate.toISOString());

      // Fetch top banners - use banners table with current_clicks
      const { data: topBannersData, error: bannersError } = await supabase
        .from("banners")
        .select("id, name, current_clicks")
        .gt("current_clicks", 0)
        .order("current_clicks", { ascending: false })
        .limit(5);

      if (bannersError) {
        console.error("Error fetching top banners:", bannersError);
      }

      const topBanners = topBannersData?.map(banner => ({
        banner_id: banner.id,
        banner_name: banner.name,
        clicks: banner.current_clicks || 0
      })) || [];

      // Fetch recent activity
      const { data: recentActivity } = await supabase
        .from("analytics_events")
        .select("event_type, timestamp, banner_id")
        .gte("timestamp", startDate.toISOString())
        .order("timestamp", { ascending: false })
        .limit(10);

      // Calculate CTR
      const ctr = viewCount && viewCount > 0 ? ((clickCount || 0) / viewCount) * 100 : 0;

      setAnalytics({
        totalClicks: clickCount || 0,
        totalViews: viewCount || 0,
        clickThroughRate: ctr,
        topBanners: topBanners || [],
        recentActivity: recentActivity || [],
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
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
          <h3 className="text-lg font-medium">Analytics Dashboard</h3>
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Analytics Dashboard</h3>
          <p className="text-muted-foreground">
            Track banner performance and email engagement
          </p>
        </div>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-32">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointer className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Banner click events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Email views with banners
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click-Through Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.clickThroughRate.toFixed(2)}%</div>
            <p className="text-xs text-muted-foreground">
              Clicks per view
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.topBanners.length}</div>
            <p className="text-xs text-muted-foreground">
              Banners with activity
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Banners</CardTitle>
            <CardDescription>
              Most clicked banners in selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topBanners.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No banner activity in this period
                </p>
              ) : (
                analytics.topBanners.map((banner, index) => (
                  <div key={banner.banner_id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{banner.banner_name}</p>
                        <p className="text-xs text-muted-foreground">{banner.clicks} clicks</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{banner.clicks}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest banner interactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              ) : (
                analytics.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.event_type === 'click' ? 'bg-orange-500' : 'bg-blue-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{activity.event_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
          <CardDescription>
            Analytics summary and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  {analytics.clickThroughRate > 2 
                    ? "Great engagement!" 
                    : analytics.clickThroughRate > 1 
                    ? "Good performance" 
                    : "Consider optimizing"
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {analytics.clickThroughRate > 2 
                    ? "Your banners are performing above industry average (2%)" 
                    : "Industry average CTR is around 2-3%"
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <BarChart3 className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Activity Summary</p>
                <p className="text-xs text-muted-foreground">
                  {analytics.totalClicks} total clicks from {analytics.totalViews} views in the last {dateRange}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};