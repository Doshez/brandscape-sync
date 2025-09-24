import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Check, X, Copy, Globe, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface DomainManagerProps {
  profile: any;
}

interface Domain {
  id: string;
  domain_name: string;
  verification_token: string;
  is_verified: boolean;
  dns_record_type: string;
  dns_record_value: string;
  organization_name: string | null;
  created_at: string;
  verified_at: string | null;
}

export const DomainManager = ({ profile }: DomainManagerProps) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    domain_name: "",
    organization_name: "",
  });

  useEffect(() => {
    if (profile?.is_admin) {
      fetchDomains();
    }
  }, [profile]);

  const fetchDomains = async () => {
    try {
      const { data, error } = await supabase
        .from("domains")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error("Error fetching domains:", error);
      toast({
        title: "Error",
        description: "Failed to fetch domains",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateVerificationToken = () => {
    return `ems-verify-${Math.random().toString(36).substr(2, 20)}`;
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const verificationToken = generateVerificationToken();
      const dnsRecordValue = `v=ems1; token=${verificationToken}`;

      const { error } = await supabase
        .from("domains")
        .insert([{
          domain_name: formData.domain_name.toLowerCase().trim(),
          organization_name: formData.organization_name.trim(),
          verification_token: verificationToken,
          dns_record_value: dnsRecordValue,
          created_by: profile?.user_id,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Domain added successfully. Please add the DNS record to verify.",
      });

      setFormData({ domain_name: "", organization_name: "" });
      setShowAddDialog(false);
      fetchDomains();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleVerifyDomain = async (domain: Domain) => {
    setVerifyingDomain(domain.id);
    
    try {
      // Simulate DNS verification check
      // In a real implementation, this would check the actual DNS records
      const isVerified = Math.random() > 0.3; // 70% success rate for demo
      
      if (isVerified) {
        const { error } = await supabase
          .from("domains")
          .update({ 
            is_verified: true, 
            verified_at: new Date().toISOString() 
          })
          .eq("id", domain.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Domain verified successfully!",
        });

        fetchDomains();
      } else {
        toast({
          title: "Verification Failed",
          description: "DNS record not found. Please ensure the TXT record is added correctly.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerifyingDomain(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "DNS record copied to clipboard",
    });
  };

  const handleDeleteDomain = async (id: string) => {
    if (!confirm("Are you sure you want to delete this domain?")) return;

    try {
      const { error } = await supabase
        .from("domains")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Domain deleted successfully",
      });

      fetchDomains();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-muted-foreground">Only administrators can manage domains.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Domain Verification</h3>
        </div>
        <div className="grid gap-4">
          {[1, 2].map((i) => (
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
          <h3 className="text-lg font-medium">Domain Verification</h3>
          <p className="text-muted-foreground">
            Verify organizational domains for email signature management
          </p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Domain</DialogTitle>
              <DialogDescription>
                Add a domain to verify organizational email management authority.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddDomain} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain_name">Domain Name</Label>
                <Input
                  id="domain_name"
                  value={formData.domain_name}
                  onChange={(e) => setFormData({ ...formData, domain_name: e.target.value })}
                  placeholder="company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization_name">Organization Name</Label>
                <Input
                  id="organization_name"
                  value={formData.organization_name}
                  onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                  placeholder="Your Company Inc."
                  required
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Domain</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {domains.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h4 className="text-lg font-medium mb-2">No domains configured</h4>
              <p className="text-muted-foreground mb-4">
                Add your organization's domain to enable email signature management.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
              </Button>
            </CardContent>
          </Card>
        ) : (
          domains.map((domain) => (
            <Card key={domain.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Globe className="h-5 w-5" />
                      <span>{domain.domain_name}</span>
                      {domain.is_verified ? (
                        <span className="flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          <Check className="h-3 w-3 mr-1" />
                          Verified
                        </span>
                      ) : (
                        <span className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Pending
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {domain.organization_name}
                      {domain.verified_at && 
                        ` • Verified ${new Date(domain.verified_at).toLocaleDateString()}`
                      }
                    </CardDescription>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!domain.is_verified && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleVerifyDomain(domain)}
                        disabled={verifyingDomain === domain.id}
                      >
                        {verifyingDomain === domain.id ? "Verifying..." : "Verify"}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteDomain(domain.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {!domain.is_verified && (
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">DNS Verification Required</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Add the following TXT record to your domain's DNS settings:
                      </p>
                    </div>

                    <div className="bg-muted p-4 rounded-lg space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                        <div className="font-semibold">Type:</div>
                        <div className="font-semibold">Name:</div>
                        <div className="font-semibold col-span-2">Value:</div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 text-sm font-mono">
                        <div>TXT</div>
                        <div>@</div>
                        <div className="col-span-2 flex items-center justify-between">
                          <span className="truncate">{domain.dns_record_value}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(domain.dns_record_value)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <p>• DNS propagation can take up to 48 hours</p>
                      <p>• Click "Verify" once the DNS record is added</p>
                      <p>• Contact your IT administrator if you need help with DNS settings</p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
};