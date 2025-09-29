import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink, CheckCircle, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExchangeAdminCenterSetupProps {
  profile: any;
}

interface RelayConfig {
  domain: string;
  relay_secret: string;
  is_active: boolean;
}

export const ExchangeAdminCenterSetup: React.FC<ExchangeAdminCenterSetupProps> = ({ profile }) => {
  const [relayConfig, setRelayConfig] = useState<RelayConfig | null>(null);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [domains, setDomains] = useState<any[]>([]);
  const [connectorName, setConnectorName] = useState('EmailSignatureConnector');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDomains();
    fetchRelayConfig();
  }, []);

  const fetchDomains = async () => {
    const { data } = await supabase
      .from('domains')
      .select('*')
      .eq('is_verified', true);
    
    if (data) {
      setDomains(data);
      if (data.length > 0) {
        setSelectedDomain(data[0].domain_name);
      }
    }
  };

  const fetchRelayConfig = async () => {
    const { data } = await supabase
      .from('smtp_relay_config')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (data) {
      setRelayConfig(data);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (!profile?.is_admin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only administrators can access Exchange Admin Center setup.
        </AlertDescription>
      </Alert>
    );
  }

  const connectorEndpoint = `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/smtp-relay`;
  const smartHost = `smtp-relay.${selectedDomain}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Exchange Admin Center Manual Setup</h2>
          <p className="text-muted-foreground">
            Create connectors and transport rules manually in Exchange Admin Center
          </p>
        </div>
      </div>

      {!relayConfig && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to generate an SMTP relay configuration first. Go to the SMTP Relay Protocol tab to set this up.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="connector" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connector">Create Connector</TabsTrigger>
          <TabsTrigger value="transport">Transport Rules</TabsTrigger>
          <TabsTrigger value="dns">DNS Configuration</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="connector" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Step 1: Create SMTP Connector
              </CardTitle>
              <CardDescription>
                Create a connector in Exchange Admin Center to route emails through your signature system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="connector-name">Connector Name</Label>
                <Input
                  id="connector-name"
                  value={connectorName}
                  onChange={(e) => setConnectorName(e.target.value)}
                  placeholder="Enter connector name"
                />
              </div>

              <div className="space-y-2">
                <Label>Domain Selection</Label>
                <select 
                  value={selectedDomain} 
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.domain_name}>
                      {domain.domain_name}
                    </option>
                  ))}
                </select>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Manual Steps in Exchange Admin Center:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Go to Exchange Admin Center → Mail flow → Connectors</li>
                    <li>Click "New connector"</li>
                    <li>From: Microsoft 365, To: Partner organization</li>
                    <li>Name: <Badge variant="outline">{connectorName}</Badge></li>
                    <li>Connection security: Use opportunistic TLS</li>
                    <li>Connector scope: Apply to entire organization</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Smart Host</Label>
                  <div className="flex items-center gap-2">
                    <Input value={smartHost} readOnly />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(smartHost)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Port</Label>
                  <div className="flex items-center gap-2">
                    <Input value="587" readOnly />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("587")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {relayConfig && (
                <div className="space-y-2">
                  <Label>Authentication (Optional)</Label>
                  <div className="p-3 bg-secondary rounded-md">
                    <p className="text-sm text-muted-foreground mb-2">
                      If you want to use authentication, configure these credentials:
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-20">Username:</span>
                        <Input value="relay" readOnly className="flex-1" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard("relay")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium w-20">Password:</span>
                        <Input value={relayConfig.relay_secret} readOnly className="flex-1" type="password" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(relayConfig.relay_secret)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transport" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Create Transport Rule</CardTitle>
              <CardDescription>
                Create a transport rule to route emails through your connector
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Manual Steps in Exchange Admin Center:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Go to Exchange Admin Center → Mail flow → Rules</li>
                    <li>Click "New rule" → "Create a new rule"</li>
                    <li>Name: "Email Signature Processing"</li>
                    <li>Apply this rule if: "The sender is located" → "Inside the organization"</li>
                    <li>Do the following: "Redirect the message to the following connector"</li>
                    <li>Select: <Badge variant="outline">{connectorName}</Badge></li>
                    <li>Set priority to 0 (highest)</li>
                    <li>Enable rule immediately</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Optional Conditions:</strong> You can add additional conditions to the rule:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Sender is a member of specific group</li>
                    <li>Message is sent to external recipients</li>
                    <li>Message importance is normal or high</li>
                    <li>Exclude system messages and NDRs</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  ⚠️ Important Configuration Notes
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• The transport rule will intercept outbound emails</li>
                  <li>• Emails will be processed and signatures/banners added</li>
                  <li>• Make sure your DNS MX records point to Exchange Online</li>
                  <li>• Test with internal emails first before going live</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 3: DNS Configuration</CardTitle>
              <CardDescription>
                Add DNS records to enable the smart host routing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Add these DNS records to your domain's DNS configuration:
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="p-3 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">CNAME Record</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`smtp-relay.${selectedDomain}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-mono">smtp-relay</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <p className="font-mono">CNAME</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Value:</span>
                      <p className="font-mono">ddoihmeqpjjiumqndjgk.supabase.co</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">TXT Record (SPF Update)</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`v=spf1 include:spf.protection.outlook.com include:_spf.${selectedDomain} ~all`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-mono">@</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <p className="font-mono">TXT</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Value:</span>
                      <p className="font-mono">v=spf1 include:spf.protection.outlook.com include:_spf.{selectedDomain} ~all</p>
                    </div>
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  DNS propagation can take up to 24 hours. Test your configuration after DNS records have propagated.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step 4: Testing Your Setup</CardTitle>
              <CardDescription>
                Verify that your connector and transport rules are working correctly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Testing Checklist:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Send a test email from Outlook to an external address</li>
                    <li>Check that the email is processed by the transport rule</li>
                    <li>Verify that signatures and banners are added</li>
                    <li>Confirm the email reaches the recipient</li>
                    <li>Check Exchange message trace for delivery path</li>
                  </ol>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    📧 Message Trace
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Use Exchange Admin Center → Mail flow → Message trace to track email delivery and verify the connector is being used.
                  </p>
                </div>

                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    ✅ Success Indicators
                  </h4>
                  <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <li>• Transport rule shows "Applied" in message trace</li>
                    <li>• Connector shows as "Used" in connector logs</li>
                    <li>• Email signatures and banners appear in sent emails</li>
                    <li>• Recipients receive emails without delivery issues</li>
                  </ul>
                </div>

                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                    🚨 Troubleshooting
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    <li>• Check DNS records have propagated</li>
                    <li>• Verify connector configuration and credentials</li>
                    <li>• Review transport rule conditions and actions</li>
                    <li>• Check Edge Function logs for processing errors</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};