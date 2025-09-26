import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Mail, Image, UserCheck, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UserAssignmentManagerProps {
  profile: any;
}

interface User {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string;
}

interface EmailSignature {
  id: string;
  template_name: string;
  signature_type: string;
  is_active: boolean;
}

interface Banner {
  id: string;
  name: string;
  is_active: boolean;
}

interface UserAssignment {
  id: string;
  user_id: string;
  signature_id: string;
  is_active: boolean;
  profiles?: User;
  email_signatures?: EmailSignature;
  user_banner_assignments?: Array<{
    id: string;
    banner_id: string;
    display_order: number;
    banners?: Banner;
  }>;
}

export const UserAssignmentManager = ({ profile }: UserAssignmentManagerProps) => {
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedSignature, setSelectedSignature] = useState("");
  const [selectedBanners, setSelectedBanners] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.is_admin) {
      Promise.all([
        fetchAssignments(),
        fetchUsers(),
        fetchSignatures(),
        fetchBanners()
      ]).finally(() => setLoading(false));
    }
  }, [profile]);

  const fetchAssignments = async () => {
    try {
      // Fetch assignments with related data using separate queries
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("user_email_assignments")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (assignmentsError) throw assignmentsError;

      if (!assignmentsData || assignmentsData.length === 0) {
        setAssignments([]);
        return;
      }

      // Get user IDs and signature IDs
      const userIds = assignmentsData.map(a => a.user_id);
      const signatureIds = assignmentsData.map(a => a.signature_id).filter(Boolean);

      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      if (usersError) throw usersError;

      // Fetch signatures
      const { data: signaturesData, error: signaturesError } = await supabase
        .from("email_signatures")
        .select("*")
        .in("id", signatureIds);

      if (signaturesError) throw signaturesError;

      // Fetch banner assignments
      const assignmentIds = assignmentsData.map(a => a.id);
      const { data: bannerAssignmentsData, error: bannerAssignmentsError } = await supabase
        .from("user_banner_assignments")
        .select(`
          *,
          banners(
            id,
            name,
            is_active
          )
        `)
        .in("user_assignment_id", assignmentIds);

      if (bannerAssignmentsError) throw bannerAssignmentsError;

      // Combine the data
      const enrichedAssignments = assignmentsData.map(assignment => ({
        ...assignment,
        profiles: usersData?.find(u => u.user_id === assignment.user_id),
        email_signatures: signaturesData?.find(s => s.id === assignment.signature_id),
        user_banner_assignments: bannerAssignmentsData?.filter(ba => ba.user_assignment_id === assignment.id) || []
      }));

      setAssignments(enrichedAssignments);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      toast({
        title: "Error",
        description: "Failed to fetch user assignments",
        variant: "destructive",
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "is", null)
        .order("first_name");

      if (error) throw error;
      
      // Remove duplicates based on user_id and ensure we have valid data
      const uniqueUsers = (data || []).filter((user, index, self) => 
        user.user_id && 
        user.email && 
        index === self.findIndex(u => u.user_id === user.user_id)
      );
      
      setUsers(uniqueUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchSignatures = async () => {
    try {
      const { data, error } = await supabase
        .from("email_signatures")
        .select("*")
        .eq("is_active", true)
        .order("template_name");

      if (error) throw error;
      setSignatures(data || []);
    } catch (error) {
      console.error("Error fetching signatures:", error);
    }
  };

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error("Error fetching banners:", error);
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedUser || !selectedSignature) {
      toast({
        title: "Missing Information",
        description: "Please select both a user and signature",
        variant: "destructive",
      });
      return;
    }

    try {
      // First, deactivate any existing assignment for this user
      await supabase
        .from("user_email_assignments")
        .update({ is_active: false })
        .eq("user_id", selectedUser);

      // Create new assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from("user_email_assignments")
        .insert({
          user_id: selectedUser,
          signature_id: selectedSignature,
          is_active: true
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      // Add banner assignments if any selected
      if (selectedBanners.length > 0) {
        const bannerAssignments = selectedBanners.map((bannerId, index) => ({
          user_assignment_id: assignment.id,
          banner_id: bannerId,
          display_order: index + 1
        }));

        const { error: bannerError } = await supabase
          .from("user_banner_assignments")
          .insert(bannerAssignments);

        if (bannerError) throw bannerError;
      }

      toast({
        title: "Success",
        description: "User assignment created successfully",
      });

      // Reset form and refresh data
      setSelectedUser("");
      setSelectedSignature("");
      setSelectedBanners([]);
      fetchAssignments();
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Error",
        description: "Failed to create user assignment",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("user_email_assignments")
        .update({ is_active: false })
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User assignment removed successfully",
      });

      fetchAssignments();
    } catch (error) {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "Failed to remove user assignment",
        variant: "destructive",
      });
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Admin access required to manage user assignments.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Assignment Manager</h1>
          <p className="text-muted-foreground">
            Assign email signatures and banners to users for the SMTP relay system
          </p>
        </div>
      </div>

      {/* Create Assignment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Assignment
          </CardTitle>
          <CardDescription>
            Assign a signature and optional banners to a user for automatic email processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={`user-${user.user_id}`} value={user.user_id}>
                      {user.first_name} {user.last_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature-select">Select Signature</Label>
              <Select value={selectedSignature} onValueChange={setSelectedSignature}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a signature" />
                </SelectTrigger>
                <SelectContent>
                  {signatures.map((signature) => (
                    <SelectItem key={signature.id} value={signature.id}>
                      {signature.template_name} ({signature.signature_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Select Banners (Optional)</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {banners.map((banner) => (
                <label key={banner.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBanners.includes(banner.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBanners([...selectedBanners, banner.id]);
                      } else {
                        setSelectedBanners(selectedBanners.filter(id => id !== banner.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{banner.name}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={handleCreateAssignment} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Create Assignment
          </Button>
        </CardContent>
      </Card>

      {/* Current Assignments */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Current Assignments</h2>
        
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <UserCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No user assignments found</p>
              <p className="text-sm text-muted-foreground mt-2">
                Create assignments above to enable automatic signature and banner injection
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assignments.map((assignment) => (
              <Card key={assignment.id}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {assignment.profiles?.first_name} {assignment.profiles?.last_name}
                        </span>
                        <Badge variant="outline">{assignment.profiles?.email}</Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Signature: {assignment.email_signatures?.template_name}
                        </span>
                        <Badge variant="secondary">
                          {assignment.email_signatures?.signature_type}
                        </Badge>
                      </div>

                      {assignment.user_banner_assignments?.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Image className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Banners:</span>
                          <div className="flex gap-1">
                            {assignment.user_banner_assignments.map((ba) => (
                              <Badge key={ba.id} variant="outline" className="text-xs">
                                {ba.banners?.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAssignment(assignment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};