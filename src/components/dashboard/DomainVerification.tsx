import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, RefreshCw, CheckCircle, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface DomainVerificationProps {
  profile: any;
}

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  priority?: string;
  description: string;
  optional?: boolean;
}

interface VerificationResult {
  type: string;
  name: string;
  verified: boolean;
  message?: string;
}

export const DomainVerification = ({ profile }: DomainVerificationProps) => {
  const [domain, setDomain] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "verified" | "failed" | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadDomainSettings();
  }, []);

  const loadDomainSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("brand_colors")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.brand_colors && typeof data.brand_colors === 'object') {
        const colors = data.brand_colors as any;
        if (colors.domain) {
          setDomain(colors.domain);
          setVerificationStatus(colors.domain_verification_status || "pending");
          generateDNSRecords(colors.domain);
        }
      }
    } catch (error: any) {
      console.error("Error loading domain settings:", error);
    }
  };

  const generateDNSRecords = (domainName: string) => {
    const records: DNSRecord[] = [
      {
        type: "TXT",
        name: `@`,
        value: `v=spf1 include:spf.protection.outlook.com include:sendgrid.net -all`,
        description: "SPF Record - Authorizes email servers",
      },
      {
        type: "TXT",
        name: `_dmarc`,
        value: `v=DMARC1; p=quarantine; rua=mailto:admin@${domainName}`,
        description: "DMARC Record - Email authentication policy",
      },
      {
        type: "CNAME",
        name: `selector1._domainkey`,
        value: `selector1-${domainName.replace(/\./g, "-")}._domainkey.${domainName}`,
        description: "DKIM Record 1 - Email signing (Configure in Microsoft 365 Admin Center first)",
        optional: true,
      },
      {
        type: "CNAME",
        name: `selector2._domainkey`,
        value: `selector2-${domainName.replace(/\./g, "-")}._domainkey.${domainName}`,
        description: "DKIM Record 2 - Email signing backup (Configure in Microsoft 365 Admin Center first)",
        optional: true,
      },
      {
        type: "CNAME",
        name: `autodiscover`,
        value: `autodiscover.outlook.com`,
        description: "Autodiscover - Email client configuration",
      },
      {
        type: "MX",
        name: `@`,
        value: `${domainName.replace(/\./g, "-")}.mail.protection.outlook.com`,
        priority: "0",
        description: "Mail Exchange - Email routing",
      },
    ];

    setDnsRecords(records);
  };

  const verifyDomain = async () => {
    if (!domain) {
      toast({
        title: "Error",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    setVerifying(true);
    try {
      // Use the verify-dns-records function with our generated DNS records
      const { data, error } = await supabase.functions.invoke("verify-dns-records", {
        body: { 
          domain,
          records: dnsRecords.map(record => ({
            type: record.type,
            name: record.name,
            expectedValue: record.value,
            priority: record.priority
          }))
        },
      });

      if (error) throw error;

      // Store detailed results
      const results: VerificationResult[] = data.results.map((r: any) => ({
        type: r.type,
        name: r.name,
        verified: r.verified,
        message: r.message || (r.verified ? "Verified" : "Not found or incorrect value"),
      }));
      setVerificationResults(results);

      // Check if all required (non-optional) records are verified
      const requiredRecords = dnsRecords.filter(r => !r.optional);
      const requiredResults = results.filter(r => 
        requiredRecords.some(req => req.type === r.type && req.name === r.name)
      );
      const allRequiredVerified = requiredResults.every(r => r.verified);
      const status = allRequiredVerified ? "verified" : "failed";
      setVerificationStatus(status);

      // Save verification status to brand_colors JSON field
      const { data: existingData } = await supabase
        .from("company_settings")
        .select("brand_colors, id")
        .limit(1)
        .maybeSingle();

      const existingColors = (existingData?.brand_colors as any) || {};
      const updatedColors = {
        ...existingColors,
        domain,
        domain_verification_status: status,
      };

      if (existingData?.id) {
        await supabase.from("company_settings")
          .update({
            brand_colors: updatedColors,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingData.id);
      } else {
        await supabase.from("company_settings")
          .insert({
            company_name: "Your Company",
            brand_colors: updatedColors,
          });
      }

      const failedRequired = requiredResults.filter(r => !r.verified);
      const failedOptional = results.filter(r => !r.verified && !requiredResults.includes(r));
      
      toast({
        title: status === "verified" ? "Domain Verified" : "Verification Failed",
        description: status === "verified" 
          ? "All required DNS records are configured correctly" 
          : `${failedRequired.length} required record(s) failed. ${failedOptional.length > 0 ? `${failedOptional.length} optional record(s) not configured.` : ''}`,
        variant: status === "verified" ? "default" : "destructive",
      });

      generateDNSRecords(domain);
    } catch (error: any) {
      toast({
        title: "Verification Error",
        description: error.message || "Failed to verify domain",
        variant: "destructive",
      });
      setVerificationStatus("failed");
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    });
  };

  const saveDomain = async () => {
    if (!domain) {
      toast({
        title: "Error",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get existing brand_colors
      const { data: existingData } = await supabase
        .from("company_settings")
        .select("brand_colors, id")
        .limit(1)
        .maybeSingle();

      const existingColors = (existingData?.brand_colors as any) || {};
      const updatedColors = {
        ...existingColors,
        domain,
      };

      if (existingData?.id) {
        await supabase.from("company_settings")
          .update({
            brand_colors: updatedColors,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingData.id);
      } else {
        await supabase.from("company_settings")
          .insert({
            company_name: "Your Company",
            brand_colors: updatedColors,
          });
      }

      generateDNSRecords(domain);

      toast({
        title: "Domain Saved",
        description: "DNS records have been generated for your domain",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Domain Verification
          </CardTitle>
          <CardDescription>
            Verify your domain and configure DNS records for email authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="domain">Your Domain</Label>
              <div className="flex gap-2">
                <Input
                  id="domain"
                  placeholder="yourdomain.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toLowerCase().trim())}
                />
                <Button onClick={saveDomain} variant="outline">
                  Generate Records
                </Button>
              </div>
            </div>

            {verificationStatus && (
              <Alert variant={verificationStatus === "verified" ? "default" : "destructive"}>
                {verificationStatus === "verified" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  Status: <Badge variant={verificationStatus === "verified" ? "default" : "destructive"}>
                    {verificationStatus === "verified" ? "Verified" : verificationStatus === "failed" ? "Failed" : "Pending"}
                  </Badge>
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={verifyDomain} disabled={verifying || !domain} className="w-full">
              {verifying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Verify DNS Records
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {verificationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Results</CardTitle>
            <CardDescription>
              Status of each DNS record verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {verificationResults.map((result, index) => {
                const record = dnsRecords.find(r => r.type === result.type && r.name === result.name);
                return (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                    {result.verified ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{result.type}</Badge>
                        <span className="text-sm font-medium">{result.name}</span>
                        {record?.optional && (
                          <Badge variant="secondary" className="text-xs">Optional</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {dnsRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>DNS Records to Configure</CardTitle>
            <CardDescription>
              Add these records to your domain's DNS settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dnsRecords.map((record, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{record.type}</Badge>
                      <span className="text-sm font-medium">{record.description}</span>
                      {record.optional && (
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(record.value, record.type)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="col-span-2 font-mono text-xs break-all">{record.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">Value:</span>
                      <span className="col-span-2 font-mono text-xs break-all">{record.value}</span>
                    </div>
                    {record.priority && (
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-muted-foreground">Priority:</span>
                        <span className="col-span-2 font-mono text-xs">{record.priority}</span>
                      </div>
                    )}
                  </div>
                  {index < dnsRecords.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>Important:</strong> DNS changes can take up to 48 hours to propagate.</p>
            <p className="text-sm"><strong>DKIM Records:</strong> These must be configured in Microsoft 365 Admin Center first. Go to Microsoft 365 Admin → Settings → Domains → Select your domain → Enable DKIM signing. Microsoft will provide the correct CNAME values.</p>
            <p className="text-sm">For Exchange Online deployment, use the dedicated "Deploy to Exchange" section with automated transport rules.</p>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>DNS records are typically managed through your domain registrar or hosting provider:</p>
          <ul className="list-disc ml-4 space-y-1 text-muted-foreground">
            <li>GoDaddy, Namecheap, Google Domains - Check DNS Management</li>
            <li>Cloudflare - DNS section in dashboard</li>
            <li>Microsoft 365 Admin - Domains &gt; DNS records</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
