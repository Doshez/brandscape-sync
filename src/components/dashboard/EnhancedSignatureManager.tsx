import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye, FileText, Send, Loader2, Upload, Users, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HtmlEditor } from "@/components/ui/html-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EnhancedSignatureManagerProps {
  profile: any;
}

interface EmailSignature {
  id: string;
  template_name: string;
  html_content: string;
  is_active: boolean;
  signature_type: string;
  department: string | null;
  user_id: string | null;
  created_at: string;
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
}

export const EnhancedSignatureManager = ({ profile }: EnhancedSignatureManagerProps) => {
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);
  const [isDeploying, setIsDeploying] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    template_name: "",
    html_content: "",
    signature_type: "user",
    department: "",
    user_id: "",
  });

  const [bulkAssignData, setBulkAssignData] = useState({
    signature_id: "",
    target_type: "all", // all, department, specific_users
    department: "",
    user_ids: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [signaturesResult, usersResult] = await Promise.all([
        supabase.from("email_signatures").select("*").order("created_at", { ascending: false }),
        profile?.is_admin 
          ? supabase.from("profiles").select("*").not("user_id", "is", null).order("first_name", { ascending: true })
          : Promise.resolve({ data: [], error: null })
      ]);

      if (signaturesResult.error) throw signaturesResult.error;
      if (usersResult.error) throw usersResult.error;

      // Filter signatures based on admin status
      let filteredSignatures = signaturesResult.data || [];
      if (!profile?.is_admin) {
        filteredSignatures = filteredSignatures.filter(sig => sig.user_id === profile?.user_id);
      }

      setSignatures(filteredSignatures);
      
      // Remove duplicates from users based on user_id
      const uniqueUsers = (usersResult.data || []).filter((user, index, self) => 
        user.user_id && 
        user.email && 
        index === self.findIndex(u => u.user_id === user.user_id)
      );
      setUsers(uniqueUsers);
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
      const filePath = `signatures/${fileName}`;

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

  const generateSignatureFromTemplate = (user: UserProfile, template: string): string => {
    return template
      .replace(/\{\{FIRST_NAME\}\}/g, user.first_name || '')
      .replace(/\{\{LAST_NAME\}\}/g, user.last_name || '')
      .replace(/\{\{EMAIL\}\}/g, user.email || '')
      .replace(/\{\{PHONE\}\}/g, user.phone || '')
      .replace(/\{\{MOBILE\}\}/g, user.mobile || '')
      .replace(/\{\{JOB_TITLE\}\}/g, user.job_title || '')
      .replace(/\{\{DEPARTMENT\}\}/g, user.department || '')
      .replace(/\{\{COMPANY_NAME\}\}/g, 'Your Company'); // This could come from company settings
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let htmlContent = formData.html_content;
      
      // If image is selected, upload it and insert into HTML
      if (selectedImage) {
        const imageUrl = await handleImageUpload(selectedImage);
        if (imageUrl) {
          htmlContent = `<img src="${imageUrl}" alt="Signature Image" style="max-width: 100%; height: auto;" /><br/>${htmlContent}`;
        }
      }

      const signatureData = {
        ...formData,
        html_content: htmlContent,
        user_id: formData.signature_type === "user" ? (formData.user_id === "current" ? profile?.user_id : (formData.user_id || null)) : null,
        created_by: profile?.user_id,
        department: formData.department || null,
      };

      let result;
      if (editingSignature) {
        result = await supabase
          .from("email_signatures")
          .update(signatureData)
          .eq("id", editingSignature.id);
      } else {
        result = await supabase
          .from("email_signatures")
          .insert([signatureData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: `Signature ${editingSignature ? "updated" : "created"} successfully`,
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

  const handleBulkAssign = async () => {
    try {
      const signature = signatures.find(s => s.id === bulkAssignData.signature_id);
      if (!signature) return;

      let targetUsers: UserProfile[] = [];
      
      switch (bulkAssignData.target_type) {
        case "all":
          targetUsers = users;
          break;
        case "department":
          targetUsers = users.filter(u => u.department === bulkAssignData.department);
          break;
        case "specific_users":
          targetUsers = users.filter(u => bulkAssignData.user_ids.includes(u.user_id));
          break;
      }

      // Create individual signatures for each user
      const signaturesToCreate = targetUsers.map(user => ({
        template_name: `${signature.template_name} - ${user.first_name} ${user.last_name}`,
        html_content: generateSignatureFromTemplate(user, signature.html_content),
        signature_type: "user",
        user_id: user.user_id || null,
        department: user.department || null,
        created_by: profile?.user_id,
        is_active: true,
      }));

      const { error } = await supabase
        .from("email_signatures")
        .insert(signaturesToCreate);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Assigned signatures to ${targetUsers.length} users`,
      });

      setBulkAssignData({
        signature_id: "",
        target_type: "all",
        department: "",
        user_ids: [],
      });
      setShowBulkAssignDialog(false);
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
      template_name: "",
      html_content: "",
      signature_type: "user",
      department: "",
      user_id: "",
    });
    setEditingSignature(null);
    setSelectedImage(null);
    setImagePreview("");
    setShowCreateDialog(false);
  };

  const handleEdit = (signature: EmailSignature) => {
    setFormData({
      template_name: signature.template_name,
      html_content: signature.html_content,
      signature_type: signature.signature_type,
      department: signature.department || "",
      user_id: signature.user_id || "",
    });
    setEditingSignature(signature);
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this signature?")) return;

    try {
      const { error } = await supabase
        .from("email_signatures")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Signature deleted successfully",
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

  const toggleActive = async (signature: EmailSignature) => {
    try {
      const { error } = await supabase
        .from("email_signatures")
        .update({ is_active: !signature.is_active })
        .eq("id", signature.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Signature ${!signature.is_active ? "activated" : "deactivated"}`,
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

  const deployToExchange = async (signature: EmailSignature) => {
    setIsDeploying(signature.id);
    
    try {
      // Call the enhanced deployment edge function
      const { data, error } = await supabase.functions.invoke('deploy-signature-enhanced', {
        body: {
          signature_id: signature.id,
          user_email: profile?.email,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Signature Deployed",
          description: `Email signature deployed successfully`,
        });
      } else {
        throw new Error(data.error || "Deployment failed");
      }
    } catch (error: any) {
      console.error("Exchange deployment error:", error);
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy signature to Exchange. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(null);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for signatures
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 2MB",
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Email Signatures</h3>
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
          <h3 className="text-lg font-medium">Enhanced Signature Management</h3>
          <p className="text-muted-foreground">
            Create, assign, and deploy email signatures with advanced features
          </p>
        </div>

        <div className="flex space-x-2">
          {profile?.is_admin && (
            <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Bulk Assign
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Assign Signatures</DialogTitle>
                  <DialogDescription>
                    Assign a signature template to multiple users at once.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Signature Template</Label>
                    <Select value={bulkAssignData.signature_id} onValueChange={(value) => setBulkAssignData({ ...bulkAssignData, signature_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select signature template" />
                      </SelectTrigger>
                      <SelectContent>
                        {signatures.filter(s => s.signature_type !== "user").map((signature) => (
                          <SelectItem key={signature.id} value={signature.id}>
                            {signature.template_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Target</Label>
                    <Select value={bulkAssignData.target_type} onValueChange={(value) => setBulkAssignData({ ...bulkAssignData, target_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="department">By Department</SelectItem>
                        <SelectItem value="specific_users">Specific Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {bulkAssignData.target_type === "department" && (
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Select value={bulkAssignData.department} onValueChange={(value) => setBulkAssignData({ ...bulkAssignData, department: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set(users.map(u => u.department).filter(Boolean))].map((dept) => (
                            <SelectItem key={dept} value={dept!}>
                              {dept}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowBulkAssignDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleBulkAssign} disabled={!bulkAssignData.signature_id}>
                      Assign Signatures
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Signature
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSignature ? "Edit Signature" : "Create New Signature"}
                </DialogTitle>
                <DialogDescription>
                  Design an email signature with image support and variable placeholders.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="content">Content & Design</TabsTrigger>
                    <TabsTrigger value="assignment">Assignment</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="template_name">Template Name</Label>
                      <Input
                        id="template_name"
                        value={formData.template_name}
                        onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                        placeholder="Corporate Signature Template"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signature_type">Signature Type</Label>
                      <Select value={formData.signature_type} onValueChange={(value) => setFormData({ ...formData, signature_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Personal Signature</SelectItem>
                          <SelectItem value="department">Department Template</SelectItem>
                          <SelectItem value="company">Company-wide Template</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="content" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signature_image">Signature Image (optional)</Label>
                      <Input
                        id="signature_image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                      />
                      {imagePreview && (
                        <div className="mt-2">
                          <img 
                            src={imagePreview} 
                            alt="Signature preview" 
                            className="max-w-full h-32 object-contain border rounded"
                          />
                        </div>
                      )}
                    </div>

                    <HtmlEditor
                      label="HTML Content"
                      value={formData.html_content}
                      onChange={(value) => setFormData({ ...formData, html_content: value })}
                      placeholder={`<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
  <p><strong>{{FIRST_NAME}} {{LAST_NAME}}</strong></p>
  <p><em>{{JOB_TITLE}}</em> | {{DEPARTMENT}}</p>
  <p>{{COMPANY_NAME}}</p>
  <p>📞 {{PHONE}} | 📱 {{MOBILE}}</p>
  <p>✉️ <a href="mailto:{{EMAIL}}">{{EMAIL}}</a></p>
  <hr style="border: none; border-top: 1px solid #ccc; margin: 10px 0;" />
  <p style="font-size: 12px; color: #666;">
    This email and any attachments are confidential and may be legally privileged.
  </p>
</div>`}
                      height="500px"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available variables: {`{{FIRST_NAME}}, {{LAST_NAME}}, {{EMAIL}}, {{PHONE}}, {{MOBILE}}, {{JOB_TITLE}}, {{DEPARTMENT}}, {{COMPANY_NAME}}`}
                    </p>

                    {formData.html_content && (
                      <div className="space-y-2 mt-4">
                        <Label>Final Preview</Label>
                        <div 
                          className="border rounded p-4 bg-background"
                          dangerouslySetInnerHTML={{ __html: formData.html_content }}
                        />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="assignment" className="space-y-4">
                    {formData.signature_type === "department" && (
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          placeholder="Marketing, Sales, IT, etc."
                        />
                      </div>
                    )}

                    {formData.signature_type === "user" && profile?.is_admin && (
                      <div className="space-y-2">
                        <Label htmlFor="user_id">Assign to User</Label>
                        <Select value={formData.user_id} onValueChange={(value) => setFormData({ ...formData, user_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="current">Current User</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={`sig-user-${user.user_id}`} value={user.user_id}>
                                {user.first_name} {user.last_name} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingSignature ? "Update" : "Create"} Signature
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {signatures.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-medium mb-2">No signatures yet</h4>
            <p className="text-muted-foreground mb-4">
              Create your first email signature template to get started.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Signature
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatures.map((signature) => (
                  <TableRow key={signature.id}>
                    <TableCell className="font-medium">{signature.template_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{signature.signature_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {signature.department || "—"}
                    </TableCell>
                    <TableCell>
                      {signature.is_active ? (
                        <Badge variant="default" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(signature.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deployToExchange(signature)}
                          disabled={isDeploying === signature.id}
                          className="h-8 w-8 p-0"
                        >
                          {isDeploying === signature.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleActive(signature)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEdit(signature)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(signature.id)}
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
        </Card>
      )}
    </div>
  );
};