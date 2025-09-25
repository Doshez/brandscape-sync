import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Edit, Trash2, Shield, ShieldCheck, Mail, FileText, Eye, Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
}

export const UserManager = ({ profile }: UserManagerProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
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

      setUsers(usersResult.data || []);
      setSignatures(signaturesResult.data || []);
      setBanners(bannersResult.data || []);
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
      const { error } = await supabase
        .from("profiles")
        .update(formData)
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

      // Deploy using universal deployment (admin can deploy to same domain users)
      if ((assignData.signature_id && assignData.signature_id !== "none") || 
          (assignData.banner_id && assignData.banner_id !== "none")) {
        try {
          const { data, error } = await supabase.functions.invoke('deploy-signature-universal', {
            body: {
              target_user_id: selectedUser?.user_id,
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
      
      const { data: userBanners } = await supabase
        .from("banners")
        .select("id")
        .contains("target_departments", [user.user_id])
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

      const { data, error } = await supabase.functions.invoke('deploy-signature-universal', {
        body: {
          target_user_id: user.user_id,
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
                        <SelectItem key={user.id} value={user.id}>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>All Users ({users.length})</span>
          </CardTitle>
          <CardDescription>
            Registered users in the email signature system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No users found</p>
            ) : (
              users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </div>
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">
                          {user.first_name} {user.last_name}
                        </h4>
                        {user.is_admin && (
                          <Badge variant="secondary" className="flex items-center space-x-1">
                            <ShieldCheck className="h-3 w-3" />
                            <span>Admin</span>
                          </Badge>
                        )}
                        {user.id === profile.id && (
                          <Badge variant="outline">You</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.job_title && `${user.job_title}`}
                        {user.department && ` • ${user.department}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUserId(user.id);
                        setShowAssignDialog(true);
                      }}
                      title="Assign Resources"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeployUserResources(user)}
                      title="Deploy to Email"
                      disabled={loading}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAdminStatus(user)}
                      disabled={user.id === profile.id}
                      title={user.is_admin ? "Remove Admin" : "Make Admin"}
                    >
                      {user.is_admin ? (
                        <Shield className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(user)}
                      title="Edit User"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user)}
                      disabled={user.id === profile.id}
                      title="Delete User"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};