import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Download, ExternalLink, CheckCircle, AlertCircle, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface User {
  id: string;
  user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
}

interface Signature {
  id: string;
  template_name: string;
  html_content: string;
}

interface Banner {
  id: string;
  name: string;
  html_content: string;
}

interface UserAssignment {
  user: User;
  signature?: Signature;
  banner?: Banner;
  combined_html: string;
}

const Microsoft365Integration = () => {
  const [domain, setDomain] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [selectedAssignments, setSelectedAssignments] = useState<UserAssignment[]>([]);
  const [powershellScript, setPowershellScript] = useState("");
  const [dnsRecords, setDnsRecords] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, signaturesRes, bannersRes] = await Promise.all([
        supabase.from("profiles").select("*").order("first_name"),
        supabase.from("email_signatures").select("*").eq("is_active", true),
        supabase.from("banners").select("*").eq("is_active", true)
      ]);

      setUsers(usersRes.data || []);
      setSignatures(signaturesRes.data || []);
      setBanners(bannersRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const generateUserAssignments = () => {
    // Get current assignments from database and create combined HTML
    const assignments: UserAssignment[] = users.map(user => {
      // For demo purposes, assign first signature to all users
      // In real implementation, this would come from user_email_assignments
      const signature = signatures[0];
      const banner = banners[0];
      
      let combined_html = "";
      if (signature) {
        combined_html += signature.html_content;
      }
      if (banner) {
        combined_html += `<br/>${banner.html_content}`;
      }

      return {
        user,
        signature,
        banner,
        combined_html
      };
    }).filter(assignment => assignment.combined_html.trim() !== "");

    setSelectedAssignments(assignments);
  };

  const generateTransportRule = async () => {
    if (!domain || !ruleName || selectedAssignments.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in domain, rule name, and ensure users have assignments",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const userAssignments = selectedAssignments.map(assignment => ({
        user_id: assignment.user.user_id || assignment.user.id,
        email: assignment.user.email,
        signature_id: assignment.signature?.id,
        banner_id: assignment.banner?.id,
        combined_html: assignment.combined_html
      }));

      const { data, error } = await supabase.functions.invoke('setup-exchange-transport-rules', {
        body: {
          domain,
          rule_name: ruleName,
          user_assignments: userAssignments
        }
      });

      if (error) throw error;

      setPowershellScript(data.configuration.powershell_script);
      setDnsRecords(data.configuration.dns_records);
      setIsConfigured(true);

      toast({
        title: "Success",
        description: "Microsoft 365 transport rule configuration generated!",
      });
    } catch (error: any) {
      console.error("Error generating transport rule:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate transport rule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard",
    });
  };

  const downloadScript = () => {
    const blob = new Blob([powershellScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ruleName}_transport_rule.ps1`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Microsoft 365 Integration</h1>
          <p className="text-muted-foreground">
            Generate Exchange transport rules and DNS configuration for your email signature system
          </p>
        </div>
      </div>

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup">Setup Configuration</TabsTrigger>
          <TabsTrigger value="powershell">PowerShell Script</TabsTrigger>
          <TabsTrigger value="dns">DNS Records</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Transport Rule Configuration
              </CardTitle>
              <CardDescription>
                Configure your Microsoft 365 Exchange transport rule to automatically apply email signatures and banners
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Your Email Domain</Label>
                  <Input
                    id="domain"
                    placeholder="company.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ruleName">Transport Rule Name</Label>
                  <Input
                    id="ruleName"
                    placeholder="Email_Signature_Rule"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>User Assignments Preview</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {selectedAssignments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Click "Generate Assignments" to preview user configurations
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedAssignments.map((assignment, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm">
                            {assignment.user.first_name} {assignment.user.last_name} ({assignment.user.email})
                          </span>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {assignment.signature && <span>Signature: {assignment.signature.template_name}</span>}
                            {assignment.banner && <span>Banner: {assignment.banner.name}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={generateUserAssignments} variant="outline">
                  Generate Assignments
                </Button>
                <Button 
                  onClick={generateTransportRule} 
                  disabled={loading || selectedAssignments.length === 0}
                  className="flex-1"
                >
                  {loading ? "Generating..." : "Generate Microsoft 365 Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="powershell" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>PowerShell Script for Exchange Online</CardTitle>
              <CardDescription>
                Run this script in Exchange Online PowerShell to create the transport rule
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {powershellScript ? (
                <>
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Instructions:</strong>
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Connect to Exchange Online: <code>Connect-ExchangeOnline</code></li>
                        <li>Copy and paste the script below into PowerShell</li>
                        <li>Wait 15-30 minutes for the rule to take effect</li>
                        <li>Test by sending an email from affected users</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                  <div className="relative">
                    <Textarea
                      value={powershellScript}
                      readOnly
                      className="min-h-96 font-mono text-sm"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(powershellScript)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={downloadScript}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Generate the configuration first in the Setup tab to see the PowerShell script.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DNS Records Configuration</CardTitle>
              <CardDescription>
                Add these DNS records to your domain registrar for proper email authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dnsRecords ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Required DNS Records</h3>
                    <div className="space-y-2">
                      {dnsRecords.required_records.map((record: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <p className="font-mono">{record.type}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Name</Label>
                              <p className="font-mono">{record.name}</p>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Value</Label>
                                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(record.value)}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="font-mono text-sm break-all">{record.value}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{record.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Optional DNS Records (DKIM)</h3>
                    <Alert className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Get the actual DKIM values from your Office 365 admin center under Security & Compliance → DKIM
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      {dnsRecords.optional_records.map((record: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3 opacity-75">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Type</Label>
                              <p className="font-mono">{record.type}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Name</Label>
                              <p className="font-mono">{record.name}</p>
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Value</Label>
                              <p className="font-mono text-sm text-muted-foreground">{record.value}</p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{record.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Next Steps:</strong>
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        <li>Add these DNS records at your domain registrar</li>
                        <li>In Office 365 admin center, enable DKIM for your domain</li>
                        <li>Wait for DNS propagation (up to 48 hours)</li>
                        <li>Verify records using MXToolbox or DNSChecker</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Generate the configuration first in the Setup tab to see the DNS records.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isConfigured && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-semibold">Configuration Generated Successfully!</span>
            </div>
            <p className="text-green-700 mt-2">
              Your Microsoft 365 transport rule configuration is ready. Follow the steps in the PowerShell and DNS tabs to complete the setup.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Microsoft365Integration;