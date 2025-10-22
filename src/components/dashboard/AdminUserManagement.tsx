import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, Mail, Shield, User, Eye, EyeOff } from "lucide-react";
import { z } from "zod";

interface UserProfile {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  department: string | null;
  job_title: string | null;
  is_admin: boolean;
  created_at: string;
}

const adminSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }).max(255),
  firstName: z.string().trim().min(1, { message: "First name is required" }).max(100),
  lastName: z.string().trim().min(1, { message: "Last name is required" }).max(100),
  department: z.string().trim().max(100).optional(),
  jobTitle: z.string().trim().max(100).optional(),
});

interface AdminUserManagementProps {
  profile: any;
}

export const AdminUserManagement = ({ profile }: AdminUserManagementProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]); // All users for selection
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    department: "",
    jobTitle: "",
  });

  const [selectedUserToPromote, setSelectedUserToPromote] = useState("");

  useEffect(() => {
    if (profile?.is_admin) {
      fetchUsers();
    }
  }, [profile]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all users
      const { data: allData, error: allError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (allError) throw allError;
      
      // Filter admins only for display
      const adminUsers = (allData || []).filter(user => user.is_admin);
      setUsers(adminUsers);
      setAllUsers(allData || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTemporaryPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      const validatedData = adminSchema.parse(formData);
      setSubmitting(true);

      // Generate temporary password
      const temporaryPassword = generateTemporaryPassword();

      // Create user with Supabase Admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: validatedData.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          first_name: validatedData.firstName,
          last_name: validatedData.lastName,
          department: validatedData.department || "",
          job_title: validatedData.jobTitle || "",
          requires_password_change: true,
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Failed to create user");
      }

      // Update profile with additional details and set as admin
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: validatedData.firstName,
          last_name: validatedData.lastName,
          department: validatedData.department || null,
          job_title: validatedData.jobTitle || null,
          is_admin: true,
        })
        .eq("user_id", authData.user.id);

      if (profileError) throw profileError;

      // Add admin role to user_roles table
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          role: "admin",
          created_by: profile.user_id,
        });

      if (roleError && roleError.code !== '23505') { // Ignore duplicate key error
        console.error("Error adding admin role:", roleError);
      }

      // Send welcome email with temporary password
      const loginUrl = "https://emailsigdash.cioafrica.co/";
      
      const { error: emailError } = await supabase.functions.invoke("send-welcome-email", {
        body: {
          email: validatedData.email,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          temporaryPassword: temporaryPassword,
          loginUrl: loginUrl,
          role: "Administrator",
        },
      });

      if (emailError) {
        console.error("Error sending welcome email:", emailError);
        toast({
          title: "User Created (Email Failed)",
          description: `User account created but welcome email failed. Temporary password: ${temporaryPassword}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "User Created Successfully",
          description: `Welcome email sent to ${validatedData.email}`,
        });
      }

      // Reset form and close dialog
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        department: "",
        jobTitle: "",
      });
      setIsDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error adding user:", error);
      
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        toast({
          title: "Validation Error",
          description: firstError.message,
          variant: "destructive",
        });
      } else if (error.message?.includes("already registered")) {
        toast({
          title: "User Already Exists",
          description: "A user with this email already exists",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create user",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromoteExistingUser = async () => {
    if (!selectedUserToPromote) {
      toast({
        title: "Error",
        description: "Please select a user to promote",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const selectedUser = allUsers.find(u => u.id === selectedUserToPromote);
      
      if (!selectedUser || !selectedUser.user_id) {
        throw new Error("Invalid user selection");
      }

      // Update profile to admin
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_admin: true })
        .eq("id", selectedUser.id);

      if (profileError) throw profileError;

      // Add admin role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: selectedUser.user_id,
          role: "admin",
          created_by: profile.user_id,
        });

      if (roleError && roleError.code !== '23505') {
        console.error("Error adding admin role:", roleError);
      }

      // Generate new temporary password
      const temporaryPassword = generateTemporaryPassword();
      
      // Update user password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        selectedUser.user_id,
        { 
          password: temporaryPassword,
          user_metadata: {
            requires_password_change: true
          }
        }
      );

      if (updateError) throw updateError;

      // Send welcome email
      const loginUrl = "https://emailsigdash.cioafrica.co/";
      const { error: emailError } = await supabase.functions.invoke("send-welcome-email", {
        body: {
          email: selectedUser.email,
          firstName: selectedUser.first_name,
          lastName: selectedUser.last_name,
          temporaryPassword: temporaryPassword,
          loginUrl: loginUrl,
          role: "Administrator",
        },
      });

      if (emailError) throw emailError;

      toast({
        title: "User Promoted to Administrator",
        description: `${selectedUser.email} has been promoted and notified`,
      });

      setIsPromoteDialogOpen(false);
      setSelectedUserToPromote("");
      fetchUsers();
    } catch (error: any) {
      console.error("Error promoting user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to promote user",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
      return;
    }

    try {
      // Delete user using edge function
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });

      if (error) throw error;

      toast({
        title: "Administrator Deleted",
        description: `Administrator ${email} has been deleted`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const handleResendWelcomeEmail = async (user: UserProfile) => {
    try {
      // Generate new temporary password
      const temporaryPassword = generateTemporaryPassword();
      
      // Update user password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.user_id!,
        { password: temporaryPassword }
      );

      if (updateError) throw updateError;

      // Send welcome email
      const loginUrl = "https://emailsigdash.cioafrica.co/";
      const { error: emailError } = await supabase.functions.invoke("send-welcome-email", {
        body: {
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          temporaryPassword: temporaryPassword,
          loginUrl: loginUrl,
          role: "Administrator",
        },
      });

      if (emailError) throw emailError;

      toast({
        title: "Welcome Email Resent",
        description: `New credentials sent to ${user.email}`,
      });
    } catch (error: any) {
      console.error("Error resending welcome email:", error);
      toast({
        title: "Error",
        description: "Failed to resend welcome email",
        variant: "destructive",
      });
    }
  };

  if (!profile?.is_admin) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  // Filter non-admin users for promotion
  const nonAdminUsers = allUsers.filter(u => !u.is_admin && u.user_id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administrator Management</h1>
          <p className="text-muted-foreground">
            Add and manage administrator accounts for the email signature system
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Shield className="mr-2 h-4 w-4" />
                Promote Existing User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Promote User to Administrator</DialogTitle>
                <DialogDescription>
                  Select an existing user to promote to administrator role
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userSelect">Select User</Label>
                  <Select
                    value={selectedUserToPromote}
                    onValueChange={setSelectedUserToPromote}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nonAdminUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">⚡ Actions:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• User will be promoted to Administrator</li>
                    <li>• New temporary password will be generated</li>
                    <li>• Welcome email will be sent with new credentials</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsPromoteDialogOpen(false);
                      setSelectedUserToPromote("");
                    }}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handlePromoteExistingUser}
                    disabled={submitting || !selectedUserToPromote}
                  >
                    {submitting ? "Promoting..." : "Promote to Admin"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Administrator
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Administrator</DialogTitle>
              <DialogDescription>
                Create a new administrator account. A welcome email with temporary login credentials will be sent to https://emailsigdash.cioafrica.co/
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job Title</Label>
                  <Input
                    id="jobTitle"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">⚡ Automatic Actions:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• A temporary password will be generated automatically</li>
                  <li>• Administrator will receive a welcome email with login credentials</li>
                  <li>• Administrator must change password on first login</li>
                  <li>• Link: https://emailsigdash.cioafrica.co/</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Administrator & Send Email"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Administrators ({users.length})</CardTitle>
          <CardDescription>
            Manage administrator accounts with system access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading administrators...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No administrators found. Add your first administrator to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.first_name} {user.last_name}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.department || "—"}</TableCell>
                    <TableCell>{user.job_title || "—"}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.user_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendWelcomeEmail(user)}
                            title="Resend welcome email with new password"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {user.user_id !== profile.user_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user.user_id!, user.email)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
