import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, Mail, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ExchangeUser {
  id: string;
  mail: string;
  displayName: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
}

interface ExchangeUserSyncProps {
  profile: any;
}

export const ExchangeUserSync = ({ profile }: ExchangeUserSyncProps) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setIsSyncing] = useState(false);
  const [users, setUsers] = useState<ExchangeUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [signatures, setSignatures] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string>("");
  const [selectedBanners, setSelectedBanners] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchExchangeUsers = async () => {
    setLoading(true);
    try {
      const { data: connection } = await supabase
        .from("exchange_connections")
        .select("*")
        .eq("user_id", profile.user_id)
        .eq("is_active", true)
        .single();

      if (!connection) {
        toast({
          title: "No Exchange Connection",
          description: "Please connect to Microsoft Exchange first",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch("https://graph.microsoft.com/v1.0/users", {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users from Exchange");
      }

      const data = await response.json();
      setUsers(data.value || []);
      
      toast({
        title: "Users Loaded",
        description: `Found ${data.value?.length || 0} users in Exchange`,
      });
    } catch (error: any) {
      console.error("Error fetching Exchange users:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch Exchange users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSignaturesAndBanners = async () => {
    const [sigData, bannerData] = await Promise.all([
      supabase.from("email_signatures").select("*").eq("is_active", true),
      supabase.from("banners").select("*").eq("is_active", true),
    ]);

    if (sigData.data) setSignatures(sigData.data);
    if (bannerData.data) setBanners(bannerData.data);
  };

  const syncSelectedUsers = async () => {
    if (!selectedSignature) {
      toast({
        title: "No Signature Selected",
        description: "Please select a signature to assign",
        variant: "destructive",
      });
      return;
    }

    if (selectedUsers.size === 0) {
      toast({
        title: "No Users Selected",
        description: "Please select at least one user",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const selectedUserList = users.filter(u => selectedUsers.has(u.id));
      
      for (const user of selectedUserList) {
        // Check if profile exists
        let { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", user.mail)
          .single();

        let userId: string;

        if (!existingProfile) {
          // Create profile for Exchange user
          const { data: newProfile, error } = await supabase
            .from("profiles")
            .insert({
              email: user.mail,
              first_name: user.displayName?.split(" ")[0] || "",
              last_name: user.displayName?.split(" ").slice(1).join(" ") || "",
              department: user.department,
              job_title: user.jobTitle,
            })
            .select()
            .single();

          if (error) throw error;
          userId = newProfile.id;
        } else {
          userId = existingProfile.id;
        }

        // Create user assignment
        const { data: assignment, error: assignError } = await supabase
          .from("user_email_assignments")
          .insert({
            user_id: userId,
            signature_id: selectedSignature,
            is_active: true,
          })
          .select()
          .single();

        if (assignError) throw assignError;

        // Assign banners if selected
        if (selectedBanners.size > 0) {
          const bannerAssignments = Array.from(selectedBanners).map((bannerId, index) => ({
            user_assignment_id: assignment.id,
            banner_id: bannerId,
            display_order: index + 1,
          }));

          const { error: bannerError } = await supabase
            .from("user_banner_assignments")
            .insert(bannerAssignments);

          if (bannerError) throw bannerError;
        }
      }

      toast({
        title: "Users Synced",
        description: `Successfully assigned resources to ${selectedUsers.size} user(s)`,
      });

      setSelectedUsers(new Set());
      setSelectedSignature("");
      setSelectedBanners(new Set());
    } catch (error: any) {
      console.error("Error syncing users:", error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync selected users",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.mail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleBannerSelection = (bannerId: string) => {
    const newSelected = new Set(selectedBanners);
    if (newSelected.has(bannerId)) {
      newSelected.delete(bannerId);
    } else {
      newSelected.add(bannerId);
    }
    setSelectedBanners(newSelected);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exchange User Sync</h2>
          <p className="text-muted-foreground">
            Import users from Exchange and assign signatures/banners
          </p>
        </div>
        <Button onClick={fetchExchangeUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Load Exchange Users
        </Button>
      </div>

      {users.length > 0 && (
        <>
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Search Users</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Email Signature</label>
                  <Select value={selectedSignature} onValueChange={setSelectedSignature}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select signature" />
                    </SelectTrigger>
                    <SelectContent>
                      {signatures.map((sig) => (
                        <SelectItem key={sig.id} value={sig.id}>
                          {sig.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchSignaturesAndBanners} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Resources
                </Button>
              </div>

              {banners.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Banners (Optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {banners.map((banner) => (
                      <div key={banner.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedBanners.has(banner.id)}
                          onCheckedChange={() => toggleBannerSelection(banner.id)}
                        />
                        <label className="text-sm cursor-pointer" onClick={() => toggleBannerSelection(banner.id)}>
                          {banner.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                onClick={syncSelectedUsers} 
                disabled={syncing || selectedUsers.size === 0}
                className="w-full"
              >
                <Users className="h-4 w-4 mr-2" />
                {syncing ? "Syncing..." : `Assign to ${selectedUsers.size} Selected User(s)`}
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Exchange Users ({filteredUsers.length})
              </h3>
              <Badge variant="secondary">
                {selectedUsers.size} selected
              </Badge>
            </div>

            <div className="grid gap-2">
              {filteredUsers.map((user) => (
                <Card
                  key={user.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedUsers.has(user.id) ? "bg-primary/5 border-primary" : ""
                  }`}
                  onClick={() => toggleUserSelection(user.id)}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedUsers.has(user.id)}
                      onCheckedChange={() => toggleUserSelection(user.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{user.displayName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{user.mail}</p>
                      {(user.jobTitle || user.department) && (
                        <div className="flex gap-2 mt-2">
                          {user.jobTitle && (
                            <Badge variant="outline">{user.jobTitle}</Badge>
                          )}
                          {user.department && (
                            <Badge variant="secondary">{user.department}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {users.length === 0 && !loading && (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Users Loaded</h3>
          <p className="text-muted-foreground mb-4">
            Click "Load Exchange Users" to import users from your Exchange tenant
          </p>
        </Card>
      )}
    </div>
  );
};
