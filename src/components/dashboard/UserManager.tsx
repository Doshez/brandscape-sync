import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Edit, Trash2, Shield, ShieldCheck, Mail, FileText, Eye, Send, Target, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UserManagerProps {
  profile: any;
}

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  department: string | null;
  job_title: string | null;
  phone: string | null;
  mobile: string | null;
  is_admin: boolean;
  created_at: string;
}

interface EmailSignature {
  id: string;
  template_name: string;
  html_content: string;
  signature_type: string;
  user_id: string | null;
}

interface Banner {
  id: string;
  name: string;
  html_content: string;
  is_active: boolean;
  target_departments: string[] | null;
}

interface DeploymentHistory {
  id: string;
  target_user_email: string;
  deployment_status: string;
  deployed_at: string;
  signature_id: string | null;
  banner_id: string | null;
  error_message: string | null;
}

interface UserAssignments {
  signatures: EmailSignature[];
  banners: Banner[];
  lastDeployment: DeploymentHistory | null;
}

export const UserManager = ({ profile }: UserManagerProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [userAssignments, setUserAssignments] = useState<Record<string, UserAssignments>>({});
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showBulkDeployDialog, setShowBulkDeployDialog] = useState(false);
  const [showChangeBannerDialog, setShowChangeBannerDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkBannerId, setBulkBannerId] = useState<string>("");
  const [changingBannerUser, setChangingBannerUser] = useState<UserProfile | null>(null);
  const [newBannerId, setNewBannerId] = useState<string>("");
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    department: "",
    job_title: "",
    phone: "",
    mobile: "",
    is_admin: false,
  });

  const [assignData, setAssignData] = useState({
    signature_id: "",
    banner_id: "",
  });

  useEffect(() => {
    if (profile?.is_admin) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    try {
      const [usersResult, signaturesResult, bannersResult] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("email_signatures").select("*").order("created_at", { ascending: false }),
        supabase.from("banners").select("*").order("created_at", { ascending: false })
      ]);

      if (usersResult.error) throw usersResult.error;
      if (signaturesResult.error) throw signaturesResult.error;
      if (bannersResult.error) throw bannersResult.error;

      // Remove duplicates based on email (since admin-created users don't have user_id)
      const uniqueUsers = (usersResult.data || []).filter((user, index, self) => 
        user.email && 
        index === self.findIndex(u => u.email === user.email)
      );

      setUsers(uniqueUsers);
      setSignatures(signaturesResult.data || []);
      setBanners(bannersResult.data || []);
      
      // Fetch assignments for each user
      await fetchUserAssignments(uniqueUsers);
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

  const fetchUserAssignments = async (usersList: UserProfile[]) => {
    const assignments: Record<string, UserAssignments> = {};

    for (const user of usersList) {
      try {
        // Get assigned signatures
        const { data: userSignatures } = await supabase
          .from("email_signatures")
          .select("*")
          .eq("user_id", user.user_id)
          .eq("is_active", true);

        // Get assigned banners (check if user is in target_departments)
        const { data: userBanners } = await supabase
          .from("banners")
          .select("*")
          .or(`target_departments.is.null,target_departments.cs.{${user.id}}`)
          .eq("is_active", true);

        // Get latest deployment
        const { data: latestDeployment } = await supabase
          .from("deployment_history")
          .select("*")
          .eq("target_user_email", user.email)
          .order("deployed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        assignments[user.id] = {
          signatures: userSignatures || [],
          banners: userBanners || [],
          lastDeployment: latestDeployment
        };
      } catch (error) {
        console.error(`Error fetching assignments for ${user.email}:`, error);
        assignments[user.id] = {
          signatures: [],
          banners: [],
          lastDeployment: null
        };
      }
    }

    setUserAssignments(assignments);
  };

  const handleEdit = (user: UserProfile) => {
    setFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      password: "",
      department: user.department || "",
      job_title: user.job_title || "",
      phone: user.phone || "",
      mobile: user.mobile || "",
      is_admin: user.is_admin,
    });
    setEditingUser(user);
    setShowEditDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingUser) return;

    try {
      // Exclude password field as it's not in profiles table
      const { password, ...updateData } = formData;
      
      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", editingUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User updated successfully",
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
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      department: "",
      job_title: "",
      phone: "",
      mobile: "",
      is_admin: false,
    });
    setEditingUser(null);
    setShowEditDialog(false);
    setShowCreateDialog(false);
  };

  const resetAssignDialog = () => {
    setAssignData({
      signature_id: "",
      banner_id: "",
    });
    setSelectedUserId("");
    setShowAssignDialog(false);
  };

  const resetAssignmentDialog = () => {
    setViewingUser(null);
    setShowAssignmentDialog(false);
  };

  const handleViewAssignments = (user: UserProfile) => {
    setViewingUser(user);
    setShowAssignmentDialog(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Create user profile without authentication (admin-created users can't login)
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: null, // Admin-created users have no auth record
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          department: formData.department,
          job_title: formData.job_title,
          phone: formData.phone,
          mobile: formData.mobile,
          is_admin: formData.is_admin,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User profile created successfully. This user exists for signature/banner assignment but cannot login to the system.",
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

  const handleAssignToUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    try {
      const promises = [];

      // Find the selected user to get their user_id for assignment
      const selectedUser = users.find(u => u.id === selectedUserId);
      
      // Assign signature if selected
      if (assignData.signature_id && assignData.signature_id !== "none") {
        promises.push(
          supabase
            .from("email_signatures")
            .update({ user_id: selectedUser?.user_id || null })
            .eq("id", assignData.signature_id)
        );
      }

      // Create user-specific banner assignment if banner selected
      if (assignData.banner_id && assignData.banner_id !== "none") {
        const { data: banner } = await supabase
          .from("banners")
          .select("*")
          .eq("id", assignData.banner_id)
          .single();

        if (banner) {
          promises.push(
            supabase
              .from("banners")
              .update({ 
                target_departments: [selectedUser?.user_id || selectedUserId] // Use user_id if available, otherwise use profile id
              })
              .eq("id", assignData.banner_id)
          );
        }
      }

      await Promise.all(promises);

      // Deploy using enhanced admin deployment (with application permissions)
      if ((assignData.signature_id && assignData.signature_id !== "none") || 
          (assignData.banner_id && assignData.banner_id !== "none")) {
        try {
          const { data, error } = await supabase.functions.invoke('deploy-signature-admin', {
            body: {
              target_user_email: selectedUser?.email,
              admin_user_id: profile.user_id, // Current admin user
              signature_id: assignData.signature_id !== "none" ? assignData.signature_id : null,
              banner_id: assignData.banner_id !== "none" ? assignData.banner_id : null,
            }
          });

          if (error) {
            console.error("Deployment error:", error);
            toast({
              title: "Warning",
              description: "Resources assigned but deployment to email failed. Ensure admin has Exchange connection with proper permissions.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Success",
              description: `Resources assigned and deployed to ${data.result?.target_email || 'user'}`,
            });
          }
        } catch (deployError) {
          console.error("Deployment failed:", deployError);
          toast({
            title: "Warning", 
            description: "Resources assigned but deployment to email failed",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Success",
          description: "Resources assigned to user successfully",
        });
      }

      resetAssignDialog();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleAdminStatus = async (user: UserProfile) => {
    if (user.id === profile.id) {
      toast({
        title: "Error",
        description: "You cannot change your own admin status",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_admin: !user.is_admin })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `User ${!user.is_admin ? "promoted to" : "removed from"} admin`,
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

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.id === profile.id) {
      toast({
        title: "Error",
        description: "You cannot delete your own account",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}?`)) return;

    try {
      // Delete the user profile (this will cascade to auth.users due to the foreign key)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User deleted successfully",
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

  const handleDeployUserResources = async (user: UserProfile) => {
    try {
      setLoading(true);
      
      // Get user's assigned signature and banner
      const { data: userSignatures } = await supabase
        .from("email_signatures")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("is_active", true)
        .limit(1);
      
      // Get banners assigned to this user's department (or general banners)
      const { data: userBanners } = await supabase
        .from("banners")
        .select("id")
        .or(`target_departments.is.null,target_departments.cs.{${user.department || 'general'}}`)
        .eq("is_active", true)
        .limit(1);

      const signatureId = userSignatures?.[0]?.id;
      const bannerId = userBanners?.[0]?.id;

      if (!signatureId && !bannerId) {
        toast({
          title: "Nothing to deploy",
          description: "This user has no assigned signature or banner",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('deploy-signature-admin', {
        body: {
          target_user_email: user.email,
          admin_user_id: profile.user_id, // Current admin user
          signature_id: signatureId,
          banner_id: bannerId,
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Success",
        description: `Resources deployed to ${data.result?.target_email || user.email}`,
      });
      
      // Refresh assignments to show updated deployment status
      await fetchUserAssignments([user]);
    } catch (error: any) {
      console.error("Deployment error:", error);
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy resources to email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkBannerDeploy = async () => {
    if (selectedUserIds.size === 0 || !bulkBannerId) {
      toast({
        title: "Error",
        description: "Please select users and a banner",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const selectedUsers = users.filter(u => selectedUserIds.has(u.id));
      const deploymentPromises = [];

      for (const user of selectedUsers) {
        // Update banner assignment for each user
        await supabase
          .from("banners")
          .update({ 
            target_departments: [user.user_id || user.id]
          })
          .eq("id", bulkBannerId);

        // Deploy banner to user
        deploymentPromises.push(
          supabase.functions.invoke('deploy-signature-admin', {
            body: {
              target_user_email: user.email,
              admin_user_id: profile.user_id,
              banner_id: bulkBannerId,
            }
          })
        );
      }

      await Promise.all(deploymentPromises);
      
      toast({
        title: "Success",
        description: `Banner deployed to ${selectedUsers.length} users`,
      });

      setSelectedUserIds(new Set());
      setBulkBannerId("");
      setShowBulkDeployDialog(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to deploy banner",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeBanner = async () => {
    if (!changingBannerUser || !newBannerId) {
      toast({
        title: "Error",
        description: "Please select a banner",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update banner assignment
      await supabase
        .from("banners")
        .update({ 
          target_departments: [changingBannerUser.user_id || changingBannerUser.id]
        })
        .eq("id", newBannerId);

      // Deploy new banner
      const { error } = await supabase.functions.invoke('deploy-signature-admin', {
        body: {
          target_user_email: changingBannerUser.email,
          admin_user_id: profile.user_id,
          banner_id: newBannerId,
        }
      });

      if (error) {
        toast({
          title: "Warning",
          description: "Banner assigned but deployment failed",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `Banner changed and deployed to ${changingBannerUser.email}`,
        });
      }

      setShowChangeBannerDialog(false);
      setChangingBannerUser(null);
      setNewBannerId("");
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change banner",
        variant: "destructive",
      });
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUserIds(newSelection);
  };

  const selectAllUsers = () => {
    setSelectedUserIds(new Set(users.map(u => u.id)));
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-muted-foreground">Only administrators can manage users.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">User Management</h3>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(query) ||
      user.last_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.department?.toLowerCase().includes(query) ||
      user.job_title?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">User Management</h3>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>

        <div className="flex space-x-2">
          <Dialog open={showBulkDeployDialog} onOpenChange={setShowBulkDeployDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Target className="h-4 w-4 mr-2" />
                Bulk Deploy Banner
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Deploy Banner to Multiple Users</DialogTitle>
                <DialogDescription>
                  Select users and deploy one banner to all of them.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selected Users ({selectedUserIds.size})</Label>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={selectAllUsers}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                  {selectedUserIds.size > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {users.filter(u => selectedUserIds.has(u.id)).map(u => `${u.first_name} ${u.last_name}`).join(', ')}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Select Banner</Label>
                  <Select value={bulkBannerId} onValueChange={setBulkBannerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a banner" />
                    </SelectTrigger>
                    <SelectContent>
                      {banners.filter(b => b.is_active).map((banner) => (
                        <SelectItem key={banner.id} value={banner.id}>
                          {banner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowBulkDeployDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleBulkBannerDeploy} disabled={selectedUserIds.size === 0 || !bulkBannerId}>
                    Deploy to {selectedUserIds.size} Users
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a user profile for signature/banner assignment. Admin-created users cannot login to the system.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create_first_name">First Name</Label>
                    <Input
                      id="create_first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create_last_name">Last Name</Label>
                    <Input
                      id="create_last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create_email">Email</Label>
                  <Input
                    id="create_email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create_department">Department</Label>
                    <Input
                      id="create_department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create_job_title">Job Title</Label>
                    <Input
                      id="create_job_title"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create_phone">Phone</Label>
                    <Input
                      id="create_phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create_mobile">Mobile</Label>
                    <Input
                      id="create_mobile"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Admin Privileges</Label>
                  <Select 
                    value={formData.is_admin ? "true" : "false"} 
                    onValueChange={(value) => setFormData({ ...formData, is_admin: value === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Regular User</SelectItem>
                      <SelectItem value="true">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">Create User</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Assign Resources
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Assign Signature & Banner</DialogTitle>
                <DialogDescription>
                  Assign email signature and banner to a user.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAssignToUser} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={`user-select-${user.id}`} value={user.id}>
                          {user.first_name} {user.last_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Email Signature (Optional)</Label>
                  <Select value={assignData.signature_id} onValueChange={(value) => setAssignData({ ...assignData, signature_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a signature" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No signature</SelectItem>
                      {signatures.map((signature) => (
                        <SelectItem key={signature.id} value={signature.id}>
                          {signature.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Banner (Optional)</Label>
                  <Select value={assignData.banner_id} onValueChange={(value) => setAssignData({ ...assignData, banner_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a banner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No banner</SelectItem>
                      {banners.filter(b => b.is_active).map((banner) => (
                        <SelectItem key={banner.id} value={banner.id}>
                          {banner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetAssignDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">Assign Resources</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and permissions.
              </DialogDescription>
            </DialogHeader>

            {editingUser && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="job_title">Job Title</Label>
                    <Input
                      id="job_title"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile</Label>
                    <Input
                      id="mobile"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Admin Privileges</Label>
                  <Select 
                    value={formData.is_admin ? "true" : "false"} 
                    onValueChange={(value) => setFormData({ ...formData, is_admin: value === "true" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Regular User</SelectItem>
                      <SelectItem value="true">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">Update User</Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showChangeBannerDialog} onOpenChange={setShowChangeBannerDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Change Banner</DialogTitle>
              <DialogDescription>
                Change the banner for {changingBannerUser?.first_name} {changingBannerUser?.last_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select New Banner</Label>
                <Select value={newBannerId} onValueChange={setNewBannerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a banner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Remove banner</SelectItem>
                    {banners.filter(b => b.is_active).map((banner) => (
                      <SelectItem key={banner.id} value={banner.id}>
                        {banner.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowChangeBannerDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleChangeBanner}>
                  Change Banner
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>All Users ({filteredUsers.length})</span>
          </CardTitle>
          <CardDescription>
            Registered users in the email signature system
          </CardDescription>
          <div className="mt-4">
            <Input
              placeholder="Search by name, email, department, or job title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          ) : (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={selectAllUsers}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUserIds.has(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-semibold">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {user.job_title}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.department || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.is_admin && (
                            <Badge variant="secondary" className="text-xs">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {user.id === profile.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userAssignments[user.id]?.signatures?.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <FileText className="h-3 w-3 mr-1" />
                              {userAssignments[user.id].signatures.length}
                            </Badge>
                          )}
                          {userAssignments[user.id]?.banners?.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Mail className="h-3 w-3 mr-1" />
                              {userAssignments[user.id].banners.length}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewAssignments(user)}
                            title="View Assignments"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setShowAssignDialog(true);
                            }}
                            title="Assign Resources"
                            className="h-8 w-8 p-0"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeployUserResources(user)}
                            title="Deploy to Email"
                            disabled={loading}
                            className="h-8 w-8 p-0"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(user)}
                            title="Edit User"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.id === profile.id}
                            title="Delete User"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Assignment View Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Assignments & Status - {viewingUser?.first_name} {viewingUser?.last_name}
            </DialogTitle>
            <DialogDescription>
              View current assignments and deployment status for {viewingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Assigned Signatures */}
            <div>
              <h4 className="font-medium mb-2">Assigned Signatures</h4>
              {viewingUser && userAssignments[viewingUser.id]?.signatures?.length > 0 ? (
                <div className="space-y-2">
                  {userAssignments[viewingUser.id].signatures.map((signature) => (
                    <Card key={signature.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{signature.template_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Type: {signature.signature_type}
                            </p>
                          </div>
                          <Badge variant="outline">Active</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No signatures assigned</p>
              )}
            </div>

            {/* Assigned Banners */}
            <div>
              <h4 className="font-medium mb-2">Assigned Banners</h4>
              {viewingUser && userAssignments[viewingUser.id]?.banners?.length > 0 ? (
                <div className="space-y-2">
                  {userAssignments[viewingUser.id].banners.map((banner) => (
                    <Card key={banner.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{banner.name}</p>
                            <div 
                              className="text-xs text-muted-foreground mt-1"
                              dangerouslySetInnerHTML={{ __html: banner.html_content.substring(0, 100) + '...' }}
                            />
                          </div>
                          <Badge variant="outline">Active</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No banners assigned</p>
              )}
            </div>

            {/* Last Deployment Status */}
            <div>
              <h4 className="font-medium mb-2">Last Deployment</h4>
              {viewingUser && userAssignments[viewingUser.id]?.lastDeployment ? (
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm">
                          <span className="font-medium">Status:</span>{" "}
                          <Badge 
                            variant={userAssignments[viewingUser.id].lastDeployment?.deployment_status === 'success' ? 'default' : 'destructive'}
                          >
                            {userAssignments[viewingUser.id].lastDeployment?.deployment_status}
                          </Badge>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(userAssignments[viewingUser.id].lastDeployment?.deployed_at || '').toLocaleString()}
                        </p>
                        {userAssignments[viewingUser.id].lastDeployment?.error_message && (
                          <p className="text-xs text-destructive mt-1">
                            Error: {userAssignments[viewingUser.id].lastDeployment?.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-muted-foreground">No deployments recorded</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={resetAssignmentDialog}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};