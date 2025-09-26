import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Eye, FileText, ExternalLink, Send, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExchangeIntegration } from "./ExchangeIntegration";

interface SignatureManagerProps {
  profile: any;
}

interface EmailSignature {
  id: string;
  template_name: string;
  html_content: string;
  is_active: boolean;
  signature_type: string;
  department: string | null;
  created_at: string;
}

export const SignatureManager = ({ profile }: SignatureManagerProps) => {
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);
  const [exchangeConnected, setExchangeConnected] = useState(false);
  const [isDeploying, setIsDeploying] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    template_name: "",
    html_content: "",
    signature_type: "user",
    department: "",
  });

  useEffect(() => {
    fetchSignatures();
  }, []);

  const fetchSignatures = async () => {
    try {
      let query = supabase.from("email_signatures").select("*");
      
      if (!profile?.is_admin) {
        query = query.eq("user_id", profile?.user_id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setSignatures(data || []);
    } catch (error) {
      console.error("Error fetching signatures:", error);
      toast({
        title: "Error",
        description: "Failed to fetch signatures",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const signatureData = {
        ...formData,
        user_id: formData.signature_type === "user" ? profile?.user_id : null,
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
      fetchSignatures();
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
    });
    setEditingSignature(null);
    setShowCreateDialog(false);
  };

  const handleEdit = (signature: EmailSignature) => {
    setFormData({
      template_name: signature.template_name,
      html_content: signature.html_content,
      signature_type: signature.signature_type,
      department: signature.department || "",
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

      fetchSignatures();
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

      fetchSignatures();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deployToExchange = async (signature: EmailSignature) => {
    if (!exchangeConnected) {
      toast({
        title: "Exchange Not Connected",
        description: "Please connect to Microsoft Exchange first in the Exchange Integration tab.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(signature.id);
    
    try {
      // Get stored access token (in a real app, you'd manage this more securely)
      const accessToken = localStorage.getItem('microsoft_access_token');
      if (!accessToken) {
        throw new Error("No access token found. Please reconnect to Exchange.");
      }

      const { data, error } = await supabase.functions.invoke('deploy-signature', {
        body: {
          access_token: accessToken,
          signature_html: signature.html_content,
          user_email: profile?.email,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Signature Deployed",
          description: `Email signature "${signature.template_name}" deployed to Exchange successfully`,
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
      <Tabs defaultValue="signatures" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="exchange">Exchange Integration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="signatures" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Email Signatures</h3>
              <p className="text-muted-foreground">
                Manage email signatures for your organization
              </p>
            </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Signature
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSignature ? "Edit Signature" : "Create New Signature"}
              </DialogTitle>
              <DialogDescription>
                Design an email signature template for your organization.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template_name">Template Name</Label>
                  <Input
                    id="template_name"
                    value={formData.template_name}
                    onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                    placeholder="Marketing Team Signature"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signature_type">Type</Label>
                  <Select value={formData.signature_type} onValueChange={(value) => setFormData({ ...formData, signature_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Personal</SelectItem>
                      <SelectItem value="department">Department</SelectItem>
                      <SelectItem value="company">Company-wide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="html_content">HTML Content</Label>
                <Textarea
                  id="html_content"
                  value={formData.html_content}
                  onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                  placeholder={`<div style="font-family: Arial, sans-serif; font-size: 14px;">
  <p><strong>{{FIRST_NAME}} {{LAST_NAME}}</strong></p>
  <p>{{JOB_TITLE}} | {{DEPARTMENT}}</p>
  <p>{{COMPANY_NAME}}</p>
  <p>📞 {{PHONE}} | 📱 {{MOBILE}}</p>
  <p>✉️ {{EMAIL}}</p>
</div>`}
                  rows={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Use variables: {`{{FIRST_NAME}}, {{LAST_NAME}}, {{EMAIL}}, {{PHONE}}, {{MOBILE}}, {{JOB_TITLE}}, {{DEPARTMENT}}, {{COMPANY_NAME}}`}
                </p>
              </div>

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

      <div className="grid gap-4">
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
          signatures.map((signature) => (
            <Card key={signature.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{signature.template_name}</span>
                      {signature.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                          Inactive
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {signature.signature_type} signature
                      {signature.department && ` • ${signature.department}`}
                    </CardDescription>
                  </div>

                  <div className="flex items-center space-x-2">
                    {exchangeConnected && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => deployToExchange(signature)}
                        disabled={isDeploying === signature.id}
                      >
                        {isDeploying === signature.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => toggleActive(signature)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(signature)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(signature.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: signature.html_content }} />
                </div>
              </CardContent>
            </Card>
          ))
        )}
        </div>
        </TabsContent>
        
        <TabsContent value="exchange" className="space-y-6">
          <ExchangeIntegration 
            onUserConnected={(user) => {
              setExchangeConnected(true);
              localStorage.setItem('microsoft_access_token', user.access_token);
              toast({
                title: "Exchange Connected",
                description: "You can now deploy signatures directly to Exchange mailboxes.",
              });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};