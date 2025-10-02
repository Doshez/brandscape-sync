import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ExchangeConnectorDiagnostic() {
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();

  const requiredSettings = [
    { label: "Smart Host", value: "smtp.sendgrid.net", key: "smartHost" },
    { label: "Port", value: "587 or 2525", key: "port" },
    { label: "TLS Enabled", value: "Yes", key: "tls" },
    { label: "TLS Certificate", value: "*.sendgrid.net", key: "tlsCert" },
    { label: "Auth Username", value: "apikey", key: "username" },
    { label: "Auth Password", value: "Your SendGrid API Key", key: "password" },
  ];

  const exchangeIpRanges = [
    "13.107.6.152/31",
    "13.107.18.10/31",
    "13.107.128.0/22",
    "23.103.160.0/20",
    "40.92.0.0/15",
    "40.107.0.0/16",
    "52.100.0.0/14",
    "104.47.0.0/17",
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "IP ranges copied to clipboard",
    });
  };

  const testSendGridConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-sendgrid-connection");
      
      if (error) throw error;
      
      setTestResults(data);
      
      if (data.success) {
        toast({
          title: "Connection Successful",
          description: "SendGrid API is accessible and authenticated",
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message || "Unable to connect to SendGrid",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const StatusIcon = ({ status }: { status: "success" | "error" | "warning" }) => {
    if (status === "success") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    if (status === "error") return <XCircle className="h-5 w-5 text-red-600" />;
    return <AlertCircle className="h-5 w-5 text-yellow-600" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Exchange Connector Diagnostic</CardTitle>
          <CardDescription>
            Verify your Exchange outbound connector settings and troubleshoot validation issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Required Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Required Connector Settings</h3>
            <div className="space-y-3">
              {requiredSettings.map((setting) => (
                <div key={setting.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-sm font-medium">{setting.label}</Label>
                    <p className="text-sm text-muted-foreground mt-1">{setting.value}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* SendGrid IP Allowlist */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Exchange Online IP Ranges</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add these IP ranges to SendGrid's IP Access Management to allow Exchange Online connections
            </p>
            
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(exchangeIpRanges.join("\n"))}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy All IP Ranges
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href="https://app.sendgrid.com/settings/access"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open SendGrid IP Access
                </a>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {exchangeIpRanges.map((ip) => (
                <div
                  key={ip}
                  className="p-2 bg-muted/50 rounded text-sm font-mono"
                >
                  {ip}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Connection Test */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Test SendGrid Connection</h3>
            <Button onClick={testSendGridConnection} disabled={testing}>
              {testing ? "Testing..." : "Test Connection"}
            </Button>

            {testResults && (
              <Alert className="mt-4">
                <StatusIcon status={testResults.success ? "success" : "error"} />
                <AlertDescription>
                  <div className="ml-2">
                    <p className="font-medium">
                      {testResults.success ? "Connection Successful" : "Connection Failed"}
                    </p>
                    <p className="text-sm mt-1">{testResults.message}</p>
                    {testResults.details && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(testResults.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Troubleshooting Checklist */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Troubleshooting Checklist</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">SendGrid account is verified</p>
                  <p className="text-xs text-muted-foreground">Check at https://app.sendgrid.com/settings/sender_auth</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">SendGrid API key has Mail Send permissions</p>
                  <p className="text-xs text-muted-foreground">Create new key at https://app.sendgrid.com/settings/api_keys</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Exchange Online IPs are allowlisted in SendGrid</p>
                  <p className="text-xs text-muted-foreground">Configure at https://app.sendgrid.com/settings/access</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Port 587 or 2525 is not blocked by firewall</p>
                  <p className="text-xs text-muted-foreground">Contact your network administrator if needed</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Use a real external email for validation test</p>
                  <p className="text-xs text-muted-foreground">Not the same domain you're configuring</p>
                </div>
              </div>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Even if Exchange validation fails, your connector may still work for actual emails (as shown in your message tracking logs with "250 2.0.0 OK" responses). The validation test is stricter than actual email delivery.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
