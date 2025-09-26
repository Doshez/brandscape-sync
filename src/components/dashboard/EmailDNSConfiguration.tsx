import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Shield, 
  Copy, 
  CheckCircle, 
  AlertTriangle, 
  Globe, 
  Mail, 
  Settings, 
  Lock,
  ExternalLink,
  Info,
  Loader2,
  Send
} from "lucide-react";

interface VerifiedDomain {
  id: string;
  domain_name: string;
  organization_name: string | null;
  is_verified: boolean;
  verified_at: string | null;
}

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  description: string;
  importance: "critical" | "recommended" | "optional";
}

interface EmailDNSConfigurationProps {
  profile: any;
}

export const EmailDNSConfiguration = ({ profile }: EmailDNSConfigurationProps) => {
  const [verifiedDomains, setVerifiedDomains] = useState<VerifiedDomain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<VerifiedDomain | null>(null);
  const [selectorName, setSelectorName] = useState("selector1");
  const [generatedRecords, setGeneratedRecords] = useState<DNSRecord[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<Record<string, "pending" | "verified" | "failed">>({});
  const [dnsHealthStatus, setDnsHealthStatus] = useState<"inactive" | "partial" | "active">("inactive");
  const [foundSelectors, setFoundSelectors] = useState<Array<{selector: string, found: boolean, record?: string}>>([]);
  const [loading, setLoading] = useState(true);
  
  // Test email states
  const [testEmail, setTestEmail] = useState('');
  const [testFromEmail, setTestFromEmail] = useState('');
  const [includeSignature, setIncludeSignature] = useState(false);
  const [includeBanner, setIncludeBanner] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState('');
  const [selectedBannerId, setSelectedBannerId] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  
  // Data for dropdowns
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [systemSignatures, setSystemSignatures] = useState<any[]>([]);
  const [systemBanners, setSystemBanners] = useState<any[]>([]);
  const [loadingDropdownData, setLoadingDropdownData] = useState(false);
  
  // Transport rule states
  const [showTransportRuleDialog, setShowTransportRuleDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [transportRuleName, setTransportRuleName] = useState('');
  const [generatingRules, setGeneratingRules] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  
  const { toast } = useToast();

  // Fetch verified domains on component mount
  useEffect(() => {
    if (profile?.is_admin) {
      fetchVerifiedDomains();
      fetchDropdownData();
    }
  }, [profile]);

  const fetchVerifiedDomains = async () => {
    try {
      const { data, error } = await supabase
        .from("domains")
        .select("id, domain_name, organization_name, is_verified, verified_at")
        .eq("is_verified", true)
        .order("domain_name", { ascending: true });

      if (error) throw error;
      
      setVerifiedDomains(data || []);
    } catch (error) {
      console.error("Error fetching verified domains:", error);
      toast({
        title: "Error",
        description: "Failed to fetch verified domains",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    setLoadingDropdownData(true);
    try {
      // Fetch users from profiles
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, user_id")
        .order("email", { ascending: true });

      if (usersError) throw usersError;

      // Fetch email signatures
      const { data: signatures, error: signaturesError } = await supabase
        .from("email_signatures")
        .select("id, template_name, html_content, signature_type")
        .eq("is_active", true)
        .order("template_name", { ascending: true });

      if (signaturesError) throw signaturesError;

      // Fetch banners
      const { data: banners, error: bannersError } = await supabase
        .from("banners")
        .select("id, name, html_content")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (bannersError) throw bannersError;

      setSystemUsers(users || []);
      setSystemSignatures(signatures || []);
      setSystemBanners(banners || []);
    } catch (error) {
      console.error("Error fetching dropdown data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch system data",
        variant: "destructive",
      });
    } finally {
      setLoadingDropdownData(false);
    }
  };

  // Handle domain selection
  const handleDomainSelect = (domainId: string) => {
    console.log("Domain selected:", domainId);
    setSelectedDomainId(domainId);
    const domain = verifiedDomains.find(d => d.id === domainId);
    console.log("Found domain:", domain);
    setSelectedDomain(domain || null);
    
    // Clear existing records and selectors when changing domain
    setGeneratedRecords([]);
    setVerificationStatus({});
    setDnsHealthStatus("inactive");
    setFoundSelectors([]);
  };

  // Generate DNS records based on selected domain
  const generateDNSRecords = async () => {
    if (!selectedDomain) {
      toast({
        title: "Domain Required",
        description: "Please select a verified domain to generate DNS records.",
        variant: "destructive",
      });
      return;
    }

    const cleanDomain = selectedDomain.domain_name.toLowerCase();
    const orgName = selectedDomain.organization_name || cleanDomain;

    // Check if we have a found DKIM record for the selected selector
    const foundSelector = foundSelectors.find(s => s.selector === selectorName && s.found);
    let dkimValue = `v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...`; // Default placeholder
    
    if (foundSelector && foundSelector.record) {
      dkimValue = foundSelector.record;
    } else if (selectorName && selectorName !== "selector1") {
      // If a specific selector is chosen but not found, try to fetch it
      try {
        const { data, error } = await supabase.functions.invoke('find-dkim-selector', {
          body: { domain: selectedDomain.domain_name, specificSelector: selectorName }
        });
        
        if (!error && data.foundSelectors && data.foundSelectors.length > 0) {
          const selectorData = data.foundSelectors.find((s: any) => s.selector === selectorName);
          if (selectorData && selectorData.record) {
            dkimValue = selectorData.record;
          }
        }
      } catch (error) {
        console.error("Error fetching specific DKIM selector:", error);
      }
    }

    const records: DNSRecord[] = [
      // SPF Record
      {
        type: "TXT",
        name: "@",
        value: `v=spf1 include:spf.protection.outlook.com include:_spf.${cleanDomain} -all`,
        ttl: 3600,
        description: "SPF (Sender Policy Framework) - Prevents email spoofing by defining authorized sending servers",
        importance: "critical"
      },
      
      // DMARC Record
      {
        type: "TXT",
        name: "_dmarc",
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${cleanDomain}; ruf=mailto:dmarc@${cleanDomain}; sp=quarantine; adkim=r; aspf=r`,
        ttl: 3600,
        description: "DMARC (Domain-based Message Authentication) - Provides policy for SPF/DKIM failures and reporting",
        importance: "critical"
      },
      
      // DKIM Record
      {
        type: "TXT",
        name: `${selectorName}._domainkey`,
        value: dkimValue,
        ttl: 3600,
        description: "DKIM (DomainKeys Identified Mail) - Cryptographic signature for email authentication",
        importance: "critical"
      },
      
      // Microsoft Exchange Online MX Record
      {
        type: "MX",
        name: "@",
        value: `${cleanDomain.replace('.', '-')}.mail.protection.outlook.com`,
        ttl: 3600,
        priority: 0,
        description: "MX Record for Microsoft Exchange Online mail routing",
        importance: "critical"
      },
      
      // Autodiscover for Exchange
      {
        type: "CNAME",
        name: "autodiscover",
        value: "autodiscover.outlook.com",
        ttl: 3600,
        description: "Autodiscover record for automatic email client configuration",
        importance: "recommended"
      },
      
      // Email signature validation record
      {
        type: "TXT",
        name: "_emailsig",
        value: `v=sig1; org=${orgName}; authorized=true`,
        ttl: 3600,
        description: "Custom record for email signature validation and authorization",
        importance: "recommended"
      },
      
      // Brand Indicators for Message Identification (BIMI)
      {
        type: "TXT",
        name: "default._bimi",
        value: `v=BIMI1; l=https://${cleanDomain}/logo.svg; a=https://${cleanDomain}/cert.pem`,
        ttl: 3600,
        description: "BIMI record for brand logo display in compatible email clients",
        importance: "optional"
      }
    ];

    setGeneratedRecords(records);
    
    // Initialize verification status
    const status: Record<string, "pending"> = {};
    records.forEach((record, index) => {
      status[`${record.type}-${index}`] = "pending";
    });
    setVerificationStatus(status);
    setDnsHealthStatus("inactive"); // Reset health status when new records are generated

    toast({
      title: "DNS Records Generated",
      description: `Generated ${records.length} DNS records for ${cleanDomain}`,
    });
  };

  // Function to find DKIM selectors
  const findDKIMSelectors = async () => {
    if (!selectedDomain) {
      toast({
        title: "Domain Required",
        description: "Please select a verified domain first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true); 
    try {
      const { data, error } = await supabase.functions.invoke('find-dkim-selector', {
        body: { domain: selectedDomain.domain_name }
      });

      if (error) throw error;

      if (data.foundSelectors && data.foundSelectors.length > 0) {
        setFoundSelectors(data.foundSelectors);
        toast({
          title: "DKIM Selectors Found",
          description: `Found ${data.foundSelectors.length} DKIM selector(s) for ${selectedDomain.domain_name}`,
        });
      } else {
        setFoundSelectors([]);
        toast({
          title: "No DKIM Selectors Found",
          description: data.message || "No active DKIM selectors detected. You may need to configure DKIM with your email provider first.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error finding DKIM selectors:", error);
      toast({
        title: "Error",
        description: "Failed to search for DKIM selectors",
        variant: "destructive",
      });
      setFoundSelectors([]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${label} has been copied to your clipboard.`,
    });
  };

  const copyAllRecords = () => {
    const allRecords = generatedRecords.map(record => {
      const line = `${record.type}\t${record.name}\t${record.value}${record.priority ? `\t${record.priority}` : ''}\t${record.ttl}`;
      return line;
    }).join('\n');
    
    copyToClipboard(allRecords, "All DNS Records");
  };

  const verifyDNSRecord = async (recordKey: string, recordIndex: number) => {
    if (!selectedDomain || !generatedRecords[recordIndex]) return;

    const record = generatedRecords[recordIndex];
    setVerificationStatus(prev => ({
      ...prev,
      [recordKey]: "pending"
    }));

    try {
      const { data, error } = await supabase.functions.invoke('verify-dns-records', {
        body: {
          domain: selectedDomain.domain_name,
          records: [{
            type: record.type,
            name: record.name,
            expectedValue: record.value,
            recordKey: recordKey
          }]
        }
      });

      if (error) throw error;

      const result = data.results[0];
      const newStatus: "verified" | "failed" = result.verified ? "verified" : "failed";
      
      setVerificationStatus(prev => {
        const updatedStatus = {
          ...prev,
          [recordKey]: newStatus
        };
        
        // Update overall DNS health status based on verification results
        updateDNSHealthStatus(updatedStatus);
        
        return updatedStatus;
      });

      if (!result.verified) {
        toast({
          title: "Verification Failed",
          description: result.error || "DNS record verification failed",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Record Verified",
          description: `${record.type} record is correctly configured`,
        });
      }
    } catch (error) {
      console.error("Error verifying DNS record:", error);
      setVerificationStatus(prev => ({
        ...prev,
        [recordKey]: "failed"
      }));
      toast({
        title: "Verification Error",
        description: "Failed to verify DNS record",
        variant: "destructive",
      });
    }
  };

  const verifyAllRecords = async () => {
    if (!selectedDomain || generatedRecords.length === 0) return;

    // Set all records to pending
    const pendingStatus: Record<string, "pending"> = {};
    generatedRecords.forEach((_, index) => {
      pendingStatus[`${generatedRecords[index].type}-${index}`] = "pending";
    });
    setVerificationStatus(pendingStatus);

    try {
      const records = generatedRecords.map((record, index) => ({
        type: record.type,
        name: record.name,
        expectedValue: record.value,
        recordKey: `${record.type}-${index}`
      }));

      const { data, error } = await supabase.functions.invoke('verify-dns-records', {
        body: {
          domain: selectedDomain.domain_name,
          records: records
        }
      });

      if (error) throw error;

      const newStatus: Record<string, "verified" | "failed"> = {};
      data.results.forEach((result: any) => {
        newStatus[result.recordKey] = result.verified ? "verified" : "failed";
      });

      setVerificationStatus(newStatus);
      updateDNSHealthStatus(newStatus);

      toast({
        title: "Verification Complete",
        description: `${data.summary.verified}/${data.summary.total} records verified successfully`,
      });
    } catch (error) {
      console.error("Error verifying all DNS records:", error);
      toast({
        title: "Verification Error",
        description: "Failed to verify DNS records",
        variant: "destructive",
      });
    }
  };

  // Calculate DNS health status based on verification results
  const updateDNSHealthStatus = (statusMap: Record<string, "pending" | "verified" | "failed">) => {
    const criticalRecords = generatedRecords.filter(record => record.importance === "critical");
    const verifiedCritical = criticalRecords.filter((_, index) => 
      statusMap[`${generatedRecords[index].type}-${index}`] === "verified"
    ).length;
    
    const totalVerified = Object.values(statusMap).filter(status => status === "verified").length;
    const totalRecords = generatedRecords.length;
    
    // All critical records verified = active
    if (verifiedCritical === criticalRecords.length && criticalRecords.length > 0) {
      setDnsHealthStatus("active");
    }
    // Some records verified but not all critical = partial
    else if (totalVerified > 0) {
      setDnsHealthStatus("partial");
    }
    // No records verified = inactive
    else {
      setDnsHealthStatus("inactive");
    }
  };

  // Send test email
  const sendTestEmail = async () => {
    if (!testEmail || !testFromEmail || !selectedDomain) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      let signatureContent = '';
      let bannerContent = '';

      // Get signature content if selected
      if (includeSignature && selectedSignatureId) {
        const signature = systemSignatures.find(s => s.id === selectedSignatureId);
        if (signature) {
          signatureContent = signature.html_content;
        }
      }

      // Get banner content if selected
      if (includeBanner && selectedBannerId) {
        const banner = systemBanners.find(b => b.id === selectedBannerId);
        if (banner) {
          bannerContent = banner.html_content;
        }
      }

      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          to: testEmail,
          from: testFromEmail,
          domain: selectedDomain.domain_name,
          includeSignature,
          includeBanner,
          signatureContent: includeSignature ? signatureContent : undefined,
          bannerContent: includeBanner ? bannerContent : undefined,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Test Email Sent",
          description: "Check your inbox to verify the email signature and banner are working correctly.",
        });
      } else {
        throw new Error(data.error || "Failed to send test email");
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast({
        title: "Failed to Send Test Email",
        description: error.message || "An error occurred while sending the test email",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  // Generate Exchange transport rules
  const generateTransportRules = async () => {
    if (!selectedDomain || selectedUsers.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a domain and at least one user",
        variant: "destructive",
      });
      return;
    }

    setGeneratingRules(true);
    try {
      // Get user assignments with signature and banner data
      const userAssignments = selectedUsers.map(userId => {
        const user = systemUsers.find(u => u.id === userId);
        const signature = selectedSignatureId ? systemSignatures.find(s => s.id === selectedSignatureId) : null;
        const banner = selectedBannerId ? systemBanners.find(b => b.id === selectedBannerId) : null;
        
        let combinedHtml = '';
        if (banner) combinedHtml += banner.html_content;
        if (signature) combinedHtml += (combinedHtml ? '<br/>' : '') + signature.html_content;
        
        return {
          user_id: userId,
          email: user?.email || '',
          signature_id: selectedSignatureId || null,
          banner_id: selectedBannerId || null,
          combined_html: combinedHtml
        };
      });

      const { data, error } = await supabase.functions.invoke('setup-exchange-transport-rules', {
        body: {
          domain: selectedDomain.domain_name,
          rule_name: transportRuleName || `EmailSignature_${selectedDomain.domain_name}`,
          user_assignments: userAssignments
        }
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedScript(data.configuration.powershell_script);
        toast({
          title: "Transport Rules Generated",
          description: "PowerShell script has been generated. Copy and run it in Exchange Online PowerShell.",
        });
      } else {
        throw new Error(data.error || "Failed to generate transport rules");
      }
    } catch (error: any) {
      console.error('Error generating transport rules:', error);
      toast({
        title: "Failed to Generate Rules",
        description: error.message || "An error occurred while generating transport rules",
        variant: "destructive",
      });
    } finally {
      setGeneratingRules(false);
    }
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case "critical": return "text-red-600 border-red-200 bg-red-50";
      case "recommended": return "text-yellow-600 border-yellow-200 bg-yellow-50";
      case "optional": return "text-blue-600 border-blue-200 bg-blue-50";
      default: return "text-gray-600 border-gray-200 bg-gray-50";
    }
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "recommended": return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Recommended</Badge>;
      case "optional": return <Badge variant="outline">Optional</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getDNSHealthStatusBadge = () => {
    switch (dnsHealthStatus) {
      case "active":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            DNS Configuration Active
          </div>
        );
      case "partial":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            DNS Partially Configured
          </div>
        );
      case "inactive":
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
            <Globe className="h-4 w-4" />
            DNS Not Configured
          </div>
        );
    }
  };

  const getDNSHealthDescription = () => {
    switch (dnsHealthStatus) {
      case "active":
        return "All critical DNS records are verified and active. Your email authentication is properly configured.";
      case "partial":
        return "Some DNS records are verified, but critical authentication records may be missing. Email delivery may be affected.";
      case "inactive":
        return "DNS records are not yet configured. Please add the generated records to your DNS provider.";
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-muted-foreground">Only administrators can manage DNS configurations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Email DNS Configuration
          </h3>
          <p className="text-muted-foreground">
            Configure DNS records to ensure email validity, authenticity, and deliverability
          </p>
        </div>
        {generatedRecords.length > 0 && getDNSHealthStatusBadge()}
      </div>

      {generatedRecords.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {dnsHealthStatus === "active" && <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />}
              {dnsHealthStatus === "partial" && <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />}
              {dnsHealthStatus === "inactive" && <Globe className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />}
              
              <div>
                <h4 className="font-medium mb-1">DNS Status for {selectedDomain?.domain_name}</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  {getDNSHealthDescription()}
                </p>
                
                {dnsHealthStatus === "active" && (
                  <div className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                    ✅ Email authentication is properly configured and active
                  </div>
                )}
                
                {dnsHealthStatus === "partial" && (
                  <div className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                    ⚠️ Some critical records may be missing - verify all critical DNS records
                  </div>
                )}
                
                {dnsHealthStatus === "inactive" && (
                  <div className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded">
                    📋 Add the generated DNS records to activate email authentication
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="records">DNS Records</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="test-email">Test Email</TabsTrigger>
          <TabsTrigger value="transport-rules">Exchange Rules</TabsTrigger>
          <TabsTrigger value="guide">Implementation Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Domain Configuration
              </CardTitle>
              <CardDescription>
                Enter your domain information to generate the required DNS records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  <div className="animate-pulse h-10 bg-muted rounded"></div>
                  <div className="animate-pulse h-10 bg-muted rounded"></div>
                  <div className="animate-pulse h-10 bg-muted rounded"></div>
                </div>
              ) : verifiedDomains.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No verified domains found. Please verify a domain in the Domain Verification section first.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-3">
                    <Label htmlFor="domainSelect">Select Verified Domain</Label>
                    <Select onValueChange={handleDomainSelect} value={selectedDomainId}>
                      <SelectTrigger id="domainSelect">
                        <SelectValue placeholder="Choose a verified domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {verifiedDomains.map((domain) => (
                          <SelectItem key={domain.id} value={domain.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{domain.domain_name}</span>
                              <div className="flex items-center gap-1 ml-2">
                                <CheckCircle className="h-3 w-3 text-green-500" />
                                <span className="text-xs text-muted-foreground">Verified</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDomain && (
                      <p className="text-xs text-muted-foreground">
                        Organization: {selectedDomain.organization_name || selectedDomain.domain_name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="selector">DKIM Selector</Label>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => findDKIMSelectors()}
                        disabled={!selectedDomain || loading}
                        className="h-8 px-3"
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Auto-Find
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="selector"
                        value={selectorName}
                        onChange={(e) => setSelectorName(e.target.value)}
                        placeholder="selector1"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      DKIM selector name (usually provided by your email service provider). Click "Auto-Find" to detect existing selectors.
                    </p>
                    
                    {/* DKIM Selector Suggestions */}
                    {foundSelectors.length > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                        <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Found DKIM Selectors
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {foundSelectors.map((selector) => (
                            <Button
                              key={selector.selector}
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectorName(selector.selector)}
                              className="h-7 px-2 text-xs bg-white hover:bg-green-100 border-green-300"
                            >
                              {selector.selector}
                            </Button>
                          ))}
                        </div>
                        <p className="text-xs text-green-700 mt-2">
                          Click on a selector to use it for DNS record generation.
                        </p>
                      </div>
                    )}
                  </div>

                  <Button 
                    onClick={generateDNSRecords} 
                    className="w-full" 
                    disabled={!selectedDomain}
                    style={{ pointerEvents: selectedDomain ? 'auto' : 'none' }}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Generate DNS Records
                    {!selectedDomain && <span className="ml-2 text-xs">(Select domain first)</span>}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          {generatedRecords.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="text-lg font-medium mb-2">No DNS Records Generated</h4>
                <p className="text-muted-foreground mb-4">
                  Please configure your domain in the Setup tab to generate DNS records.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium">
                  DNS Records for {selectedDomain?.domain_name || "Selected Domain"}
                </h4>
                <Button onClick={copyAllRecords} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All Records
                </Button>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Add these DNS records to your domain's DNS settings through your domain registrar or DNS provider. 
                  Changes may take up to 48 hours to propagate globally.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {generatedRecords.map((record, index) => (
                  <Card key={`${record.type}-${index}`} className={`border-l-4 ${getImportanceColor(record.importance)}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {record.type === "TXT" && <Mail className="h-4 w-4" />}
                            {record.type === "MX" && <Globe className="h-4 w-4" />}
                            {record.type === "CNAME" && <ExternalLink className="h-4 w-4" />}
                            {record.type} Record
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {record.description}
                          </CardDescription>
                        </div>
                        {getImportanceBadge(record.importance)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                        <div className="grid grid-cols-4 gap-2 text-xs font-semibold uppercase text-muted-foreground">
                          <div>Type</div>
                          <div>Name</div>
                          <div>Value</div>
                          <div>TTL{record.priority !== undefined && "/Priority"}</div>
                        </div>
                        
                        <Separator />
                        
                        <div className="grid grid-cols-4 gap-2 items-start">
                          <div className="font-medium">{record.type}</div>
                          <div className="break-all">{record.name}</div>
                          <div className="break-all text-xs">
                            {record.value.length > 100 ? (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-muted-foreground">
                                  Value ({record.value.length} characters):
                                </div>
                                <div className="max-h-24 overflow-y-auto bg-muted/50 p-2 rounded text-xs font-mono">
                                  {record.value}
                                </div>
                                {record.name.includes('_domainkey') && (
                                  <div className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                                    <strong>Note:</strong> Long DKIM values may need to be split across multiple strings in your DNS provider. 
                                    Some providers automatically handle this, others may require manual splitting every 255 characters.
                                  </div>
                                )}
                              </div>
                            ) : (
                              record.value
                            )}
                          </div>
                          <div>
                            {record.ttl}
                            {record.priority !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                Priority: {record.priority}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => copyToClipboard(record.value, `${record.type} Record Value`)}
                          variant="outline"
                          size="sm"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Value
                        </Button>
                        <Button
                          onClick={() => {
                            const fullRecord = `Type: ${record.type}\nName: ${record.name}\nValue: ${record.value}\nTTL: ${record.ttl}${record.priority ? `\nPriority: ${record.priority}` : ''}`;
                            copyToClipboard(fullRecord, `${record.type} Record`);
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Full Record
                        </Button>
                        {record.name.includes('_domainkey') && record.value.length > 255 && (
                          <Button
                            onClick={() => {
                              // Split DKIM value into 255-character chunks for DNS providers that need it
                              const chunks = [];
                              const cleanValue = record.value;
                              for (let i = 0; i < cleanValue.length; i += 255) {
                                chunks.push(`"${cleanValue.substring(i, i + 255)}"`);
                              }
                              const splitValue = `${record.name} IN TXT ${chunks.join(' ')}`;
                              copyToClipboard(splitValue, 'Split DKIM Record');
                            }}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy Split Format
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="verification" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                DNS Record Verification
              </CardTitle>
              <CardDescription>
                Verify that your DNS records have been properly configured and are propagating
              </CardDescription>
            </CardHeader>
            <CardContent>
              {generatedRecords.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Generate DNS records first to enable verification.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">
                      Verify individual records or check all records at once
                    </p>
                    <Button 
                      onClick={verifyAllRecords}
                      variant="default"
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Verify All Records
                    </Button>
                  </div>
                  {generatedRecords.map((record, index) => {
                    const recordKey = `${record.type}-${index}`;
                    const status = verificationStatus[recordKey];
                    
                    return (
                      <div key={recordKey} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {status === "verified" && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {status === "failed" && <AlertTriangle className="h-5 w-5 text-red-500" />}
                          {status === "pending" && <div className="h-5 w-5 border-2 border-muted rounded-full" />}
                          
                          <div>
                            <p className="font-medium">{record.type} - {record.name || '@'}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.importance === "critical" ? "Critical for email delivery" : 
                               record.importance === "recommended" ? "Recommended for security" : 
                               "Optional enhancement"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {status === "pending" && (
                            <Button
                              onClick={() => verifyDNSRecord(recordKey, index)}
                              variant="outline"
                              size="sm"
                            >
                              Verify
                            </Button>
                          )}
                          {status === "verified" && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Verified
                            </Badge>
                          )}
                          {status === "failed" && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test-email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Test Email
              </CardTitle>
              <CardDescription>
                Send a test email to verify your DNS configuration, email signatures, and banners are working correctly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="test-to-email">Send To Email *</Label>
                  <Input
                    id="test-to-email"
                    type="email"
                    placeholder="recipient@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test-from-email">From Email *</Label>
                  <Input
                    id="test-from-email"
                    type="email"
                    placeholder={selectedDomain ? `test@${selectedDomain.domain_name}` : "from@yourdomain.com"}
                    value={testFromEmail}
                    onChange={(e) => setTestFromEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label>Select Recipient</Label>
                  {loadingDropdownData ? (
                    <div className="animate-pulse h-10 bg-muted rounded"></div>
                  ) : (
                    <Select onValueChange={(value) => {
                      const user = systemUsers.find(u => u.id === value);
                      if (user && user.email) {
                        setTestEmail(user.email);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a user or enter manually" />
                      </SelectTrigger>
                      <SelectContent>
                        {systemUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex flex-col">
                              <span>{user.email}</span>
                              {user.first_name && user.last_name && (
                                <span className="text-xs text-muted-foreground">
                                  {user.first_name} {user.last_name}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-4">
                  <Label>Select From Address</Label>
                  {loadingDropdownData ? (
                    <div className="animate-pulse h-10 bg-muted rounded"></div>
                  ) : (
                    <Select onValueChange={(value) => {
                      const user = systemUsers.find(u => u.id === value);
                      if (user && user.email) {
                        setTestFromEmail(user.email);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose sender or enter manually" />
                      </SelectTrigger>
                      <SelectContent>
                        {systemUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex flex-col">
                              <span>{user.email}</span>
                              {user.first_name && user.last_name && (
                                <span className="text-xs text-muted-foreground">
                                  {user.first_name} {user.last_name}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-signature"
                    checked={includeSignature}
                    onCheckedChange={(checked) => setIncludeSignature(checked as boolean)}
                  />
                  <Label htmlFor="include-signature">Include email signature</Label>
                </div>

                {includeSignature && (
                  <div className="space-y-2">
                    <Label>Select Email Signature</Label>
                    {loadingDropdownData ? (
                      <div className="animate-pulse h-10 bg-muted rounded"></div>
                    ) : systemSignatures.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
                        No email signatures found. Create signatures in the Signature Manager first.
                      </div>
                    ) : (
                      <Select value={selectedSignatureId} onValueChange={setSelectedSignatureId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an email signature" />
                        </SelectTrigger>
                        <SelectContent>
                          {systemSignatures.map((signature) => (
                            <SelectItem key={signature.id} value={signature.id}>
                              <div className="flex flex-col">
                                <span>{signature.template_name}</span>
                                <span className="text-xs text-muted-foreground capitalize">
                                  {signature.signature_type} signature
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-banner"
                    checked={includeBanner}
                    onCheckedChange={(checked) => setIncludeBanner(checked as boolean)}
                  />
                  <Label htmlFor="include-banner">Include email banner</Label>
                </div>

                {includeBanner && (
                  <div className="space-y-2">
                    <Label>Select Email Banner</Label>
                    {loadingDropdownData ? (
                      <div className="animate-pulse h-10 bg-muted rounded"></div>
                    ) : systemBanners.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-3 bg-muted rounded">
                        No email banners found. Create banners in the Banner Manager first.
                      </div>
                    ) : (
                      <Select value={selectedBannerId} onValueChange={setSelectedBannerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an email banner" />
                        </SelectTrigger>
                        <SelectContent>
                          {systemBanners.map((banner) => (
                            <SelectItem key={banner.id} value={banner.id}>
                              {banner.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Make sure you have verified your sending domain in Resend before sending test emails. 
                  The test email will show if your DNS configuration, signatures, and banners are working correctly.
                </AlertDescription>
              </Alert>

              <Button
                onClick={sendTestEmail}
                disabled={sendingTest || !testEmail.trim() || !testFromEmail.trim()}
                className="w-full relative z-10 pointer-events-auto"
                style={{ pointerEvents: (sendingTest || !testEmail.trim() || !testFromEmail.trim()) ? 'none' : 'auto' }}
              >
                {sendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Test Email...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>

              {(!testEmail.trim() || !testFromEmail.trim()) && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Please fill in both recipient and sender email addresses to enable the send button.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Implementation Guide
              </CardTitle>
              <CardDescription>
                Step-by-step instructions for implementing email authentication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-semibold text-red-700">Critical Records (Required)</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• <strong>SPF Record:</strong> Prevents email spoofing by authorizing sending servers</li>
                    <li>• <strong>DKIM Record:</strong> Provides cryptographic authentication of emails</li>
                    <li>• <strong>DMARC Record:</strong> Sets policy for handling authentication failures</li>
                    <li>• <strong>MX Record:</strong> Routes emails to your mail servers</li>
                  </ul>
                </div>

                <div className="border-l-4 border-yellow-500 pl-4">
                  <h4 className="font-semibold text-yellow-700">Recommended Records</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• <strong>Autodiscover:</strong> Enables automatic email client configuration</li>
                    <li>• <strong>Email Signature Validation:</strong> Authorizes signature management</li>
                  </ul>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-blue-700">Optional Enhancements</h4>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <li>• <strong>BIMI Record:</strong> Displays your brand logo in email clients</li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold">Implementation Steps</h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Generate DNS records using the Setup tab</li>
                  <li>Access your domain registrar's DNS management panel</li>
                  <li>Add each DNS record with the exact values provided</li>
                  <li>Wait 24-48 hours for DNS propagation</li>
                  <li>Use the Verification tab to check record status</li>
                  <li>Monitor email delivery and authentication reports</li>
                </ol>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> Incorrect DNS configuration can affect email delivery. 
                  Test thoroughly in a staging environment before implementing in production.
                  Consider consulting with your IT team or DNS provider for assistance.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transport-rules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Exchange Transport Rules
              </CardTitle>
              <CardDescription>
                Generate PowerShell scripts to create Exchange transport rules that automatically append signatures and banners to outgoing emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rule-name">Transport Rule Name</Label>
                  <Input
                    id="rule-name"
                    placeholder={selectedDomain ? `EmailSignature_${selectedDomain.domain_name}` : "EmailSignature_YourDomain"}
                    value={transportRuleName}
                    onChange={(e) => setTransportRuleName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Signature (Optional)</Label>
                      {selectedSignatureId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSignatureId('')}
                          className="text-xs text-muted-foreground"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <Select value={selectedSignatureId} onValueChange={setSelectedSignatureId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose signature or leave empty" />
                      </SelectTrigger>
                      <SelectContent>
                        {systemSignatures.map((signature) => (
                          <SelectItem key={signature.id} value={signature.id}>
                            {signature.template_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Banner (Optional)</Label>
                      {selectedBannerId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBannerId('')}
                          className="text-xs text-muted-foreground"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <Select value={selectedBannerId} onValueChange={setSelectedBannerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose banner or leave empty" />
                      </SelectTrigger>
                      <SelectContent>
                        {systemBanners.map((banner) => (
                          <SelectItem key={banner.id} value={banner.id}>
                            {banner.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select Users for Transport Rule</Label>
                  <div className="border rounded-md p-4 max-h-48 overflow-y-auto">
                    {loadingDropdownData ? (
                      <div className="animate-pulse space-y-2">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-8 bg-muted rounded"></div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 mb-3">
                          <Checkbox
                            id="select-all"
                            checked={selectedUsers.length === systemUsers.length}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedUsers(systemUsers.map(u => u.id));
                              } else {
                                setSelectedUsers([]);
                              }
                            }}
                          />
                          <Label htmlFor="select-all" className="font-medium">
                            Select All Users ({systemUsers.length})
                          </Label>
                        </div>
                        {systemUsers.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={user.id}
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                }
                              }}
                            />
                            <Label htmlFor={user.id} className="flex flex-col">
                              <span>{user.email}</span>
                              {user.first_name && user.last_name && (
                                <span className="text-xs text-muted-foreground">
                                  {user.first_name} {user.last_name} - {user.department}
                                </span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedUsers.length} user(s)
                  </p>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Transport rules automatically append signatures and banners to ALL outgoing emails from selected users. 
                    This is the recommended approach for organization-wide signature deployment.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={generateTransportRules}
                  disabled={generatingRules || !selectedDomain || selectedUsers.length === 0}
                  className="w-full"
                >
                  {generatingRules ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Transport Rules...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Generate Exchange Transport Rules
                    </>
                  )}
                </Button>

                {generatedScript && (
                  <div className="space-y-4">
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="generated-script">Generated PowerShell Script</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedScript);
                            toast({
                              title: "Copied!",
                              description: "PowerShell script copied to clipboard",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Script
                        </Button>
                      </div>
                      <Textarea
                        id="generated-script"
                        value={generatedScript}
                        readOnly
                        rows={15}
                        className="font-mono text-xs"
                      />
                    </div>

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Next Steps:</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                          <li>Copy the PowerShell script above</li>
                          <li>Open Exchange Online PowerShell (Connect-ExchangeOnline)</li>
                          <li>Run the script to create transport rules</li>
                          <li>Wait 15-30 minutes for rules to take effect</li>
                          <li>Test by sending an email from affected users</li>
                        </ol>
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};