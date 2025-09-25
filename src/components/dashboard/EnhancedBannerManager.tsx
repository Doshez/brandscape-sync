import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye, Upload, ExternalLink, BarChart3, Users, Calendar, Target } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HtmlEditor } from "@/components/ui/html-editor";

interface EnhancedBannerManagerProps {
  profile: any;
}

interface Banner {
  id: string;
  name: string;
  html_content: string;
  image_url: string | null;
  click_url: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  campaign_id: string | null;
  priority: number;
  max_clicks: number | null;
  current_clicks: number;
  target_departments: string[] | null;
  device_targeting: string[];
  geo_targeting: string[] | null;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export const EnhancedBannerManager = ({ profile }: EnhancedBannerManagerProps) => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    html_content: "",
    click_url: "",
    campaign_id: "",
    priority: 0,
    max_clicks: "",
    target_departments: [] as string[],
    device_targeting: ["desktop", "mobile"] as string[],
    geo_targeting: [] as string[],
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (profile?.is_admin) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    try {
      const [bannersResult, campaignsResult] = await Promise.all([
        supabase.from("banners").select("*").order("created_at", { ascending: false }),
        supabase.from("campaigns").select("*").order("created_at", { ascending: false })
      ]);

      if (bannersResult.error) throw bannersResult.error;
      if (campaignsResult.error) throw campaignsResult.error;

      setBanners(bannersResult.data || []);
      setCampaigns(campaignsResult.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('email-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('email-assets')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let imageUrl = editingBanner?.image_url || null;
      
      if (selectedImage) {
        imageUrl = await handleImageUpload(selectedImage);
        if (!imageUrl) return;
      }

      const bannerData = {
        ...formData,
        image_url: imageUrl,
        max_clicks: formData.max_clicks ? parseInt(formData.max_clicks) : null,
        target_departments: formData.target_departments.length > 0 ? formData.target_departments : null,
        geo_targeting: formData.geo_targeting.length > 0 ? formData.geo_targeting : null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        campaign_id: formData.campaign_id === "none" ? null : formData.campaign_id || null,
        created_by: profile?.user_id,
      };

      let result;
      if (editingBanner) {
        result = await supabase
          .from("banners")
          .update(bannerData)
          .eq("id", editingBanner.id);
      } else {
        result = await supabase
          .from("banners")
          .insert([bannerData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `Banner ${editingBanner ? "updated" : "created"} successfully`,
      });

      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      html_content: "",
      click_url: "",
      campaign_id: "",
      priority: 0,
      max_clicks: "",
      target_departments: [],
      device_targeting: ["desktop", "mobile"],
      geo_targeting: [],
      start_date: "",
      end_date: "",
    });
    setEditingBanner(null);
    setSelectedImage(null);
    setImagePreview("");
    setShowCreateDialog(false);
  };

  const handleEdit = (banner: Banner) => {
    setFormData({
      name: banner.name,
      html_content: banner.html_content,
      click_url: banner.click_url || "",
      campaign_id: banner.campaign_id || "",
      priority: banner.priority,
      max_clicks: banner.max_clicks?.toString() || "",
      target_departments: banner.target_departments || [],
      device_targeting: banner.device_targeting,
      geo_targeting: banner.geo_targeting || [],
      start_date: banner.start_date ? banner.start_date.split('T')[0] : "",
      end_date: banner.end_date ? banner.end_date.split('T')[0] : "",
    });
    setImagePreview(banner.image_url || "");
    setEditingBanner(banner);
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;

    try {
      const { error } = await supabase
        .from("banners")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Banner deleted successfully",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (banner: Banner) => {
    try {
      const { error } = await supabase
        .from("banners")
        .update({ is_active: !banner.is_active })
        .eq("id", banner.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Banner ${!banner.is_active ? "activated" : "deactivated"}`,
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-muted-foreground">Only administrators can manage banners.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Banner Management</h3>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-20 bg-muted rounded"></div>
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
          <h3 className="text-lg font-medium">Enhanced Banner Management</h3>
          <p className="text-muted-foreground">
            Create and manage email banners with advanced targeting and analytics
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Banner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? "Edit Banner" : "Create New Banner"}
              </DialogTitle>
              <DialogDescription>
                Design an email banner with advanced targeting options.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="targeting">Targeting</TabsTrigger>
                  <TabsTrigger value="schedule">Schedule</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Banner Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Q1 Promotion Banner"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="campaign_id">Campaign</Label>
                      <Select value={formData.campaign_id} onValueChange={(value) => setFormData({ ...formData, campaign_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select campaign" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Campaign</SelectItem>
                          {campaigns.map((campaign) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority (0-10)</Label>
                      <Input
                        id="priority"
                        type="number"
                        min="0"
                        max="10"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_clicks">Max Clicks (optional)</Label>
                      <Input
                        id="max_clicks"
                        type="number"
                        value={formData.max_clicks}
                        onChange={(e) => setFormData({ ...formData, max_clicks: e.target.value })}
                        placeholder="Leave empty for unlimited"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="click_url">Click URL</Label>
                    <Input
                      id="click_url"
                      type="url"
                      value={formData.click_url}
                      onChange={(e) => setFormData({ ...formData, click_url: e.target.value })}
                      placeholder="https://example.com/promotion"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="banner_image">Banner Image</Label>
                    <Input
                      id="banner_image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                    />
                    {imagePreview && (
                      <div className="mt-2">
                        <img 
                          src={imagePreview} 
                          alt="Banner preview" 
                          className="max-w-full h-48 object-contain border rounded"
                        />
                      </div>
                    )}
                  </div>

                  <HtmlEditor
                    label="HTML Content"
                    value={formData.html_content}
                    onChange={(value) => setFormData({ ...formData, html_content: value })}
                    placeholder={`<div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
  <h2 style="margin: 0 0 10px 0;">🎉 Special Offer!</h2>
  <p style="margin: 0; font-size: 16px;">Get 25% off all products this month</p>
</div>`}
                    height="400px"
                  />
                </TabsContent>

                <TabsContent value="targeting" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Target Departments</Label>
                    <Input
                      placeholder="Marketing, Sales, IT (comma separated)"
                      value={formData.target_departments.join(", ")}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        target_departments: e.target.value.split(",").map(d => d.trim()).filter(d => d)
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Device Targeting</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.device_targeting.includes("desktop")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                device_targeting: [...formData.device_targeting, "desktop"]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                device_targeting: formData.device_targeting.filter(d => d !== "desktop")
                              });
                            }
                          }}
                        />
                        <span>Desktop</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.device_targeting.includes("mobile")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                device_targeting: [...formData.device_targeting, "mobile"]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                device_targeting: formData.device_targeting.filter(d => d !== "mobile")
                              });
                            }
                          }}
                        />
                        <span>Mobile</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Geographic Targeting</Label>
                    <Input
                      placeholder="US, UK, Canada (comma separated)"
                      value={formData.geo_targeting.join(", ")}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        geo_targeting: e.target.value.split(",").map(g => g.trim()).filter(g => g)
                      })}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="schedule" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end_date">End Date</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBanner ? "Update" : "Create"} Banner
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {banners.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No banners yet</h4>
              <p className="text-muted-foreground mb-4">
                Create your first email banner to get started.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Banner
              </Button>
            </CardContent>
          </Card>
        ) : (
          banners.map((banner) => (
            <Card key={banner.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{banner.name}</span>
                      {banner.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {banner.priority > 0 && (
                        <Badge variant="outline">Priority: {banner.priority}</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-4">
                      <span>Clicks: {banner.current_clicks}</span>
                      {banner.max_clicks && (
                        <span>/ {banner.max_clicks} max</span>
                      )}
                      {banner.target_departments && (
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {banner.target_departments.join(", ")}
                        </span>
                      )}
                      {banner.start_date && (
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(banner.start_date).toLocaleDateString()}
                        </span>
                      )}
                    </CardDescription>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(banner)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(banner)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(banner.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {banner.click_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={banner.click_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {banner.image_url && (
                    <img 
                      src={banner.image_url} 
                      alt={banner.name}
                      className="max-w-full h-32 object-contain border rounded"
                    />
                  )}
                  <div 
                    className="bg-muted p-4 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: banner.html_content }}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};