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
  Info
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
  const { toast } = useToast();

  // Fetch verified domains on component mount
  useEffect(() => {
    if (profile?.is_admin) {
      fetchVerifiedDomains();
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

  // Handle domain selection
  const handleDomainSelect = (domainId: string) => {
    setSelectedDomainId(domainId);
    const domain = verifiedDomains.find(d => d.id === domainId);
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="records">DNS Records</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
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
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Generate DNS Records
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
      </Tabs>
    </div>
  );
};