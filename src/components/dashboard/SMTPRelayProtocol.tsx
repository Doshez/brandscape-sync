import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle, AlertCircle, Mail, Server, Shield, Eye } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SMTPRelayProtocolProps {
  profile: any;
}

interface RelayConfig {
  domain: string;
  relay_secret: string;
  is_active: boolean;
}

export const SMTPRelayProtocol: React.FC<SMTPRelayProtocolProps> = ({ profile }) => {
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [relayConfig, setRelayConfig] = useState<RelayConfig | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (profile?.is_admin) {
      fetchDomains();
      fetchRelayConfig();
    }
  }, [profile]);

  const fetchDomains = async () => {
    const { data } = await supabase
      .from('domains')
      .select('*')
      .eq('is_verified', true);
    
    if (data) {
      setDomains(data);
      if (data.length > 0 && !selectedDomain) {
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
      setSelectedDomain(data.domain);
    }
  };

  const generateRelayConfig = async () => {
    if (!selectedDomain) {
      toast.error('Please select a domain first');
      return;
    }

    setIsGenerating(true);
    try {
      // Generate a secure relay secret
      const relaySecret = crypto.getRandomValues(new Uint8Array(32))
        .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

      // Check if config already exists for this domain
      const { data: existingConfig } = await supabase
        .from('smtp_relay_config')
        .select('id')
        .eq('domain', selectedDomain)
        .single();

      let data, error;

      if (existingConfig) {
        // Update existing config
        const result = await supabase
          .from('smtp_relay_config')
          .update({
            relay_secret: relaySecret,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('domain', selectedDomain)
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      } else {
        // Deactivate all existing configs first
        await supabase
          .from('smtp_relay_config')
          .update({ is_active: false })
          .eq('is_active', true);

        // Insert new config
        const result = await supabase
          .from('smtp_relay_config')
          .insert({
            domain: selectedDomain,
            relay_secret: relaySecret,
            is_active: true
          })
          .select()
          .single();
        
        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      setRelayConfig(data);
      toast.success('SMTP Relay configuration generated successfully');
    } catch (error: any) {
      toast.error('Failed to generate relay configuration: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const testRelay = async () => {
    if (!testEmail || !relayConfig) return;

    try {
      const response = await supabase.functions.invoke('smtp-relay', {
        body: {
          from: testEmail,
          to: [testEmail],
          subject: 'SMTP Relay Test',
          htmlBody: '<p>This is a test email from the SMTP relay system.</p>',
          messageId: `test-${Date.now()}@${selectedDomain}`
        },
        headers: {
          'x-relay-secret': relayConfig.relay_secret
        }
      });

      if (response.error) throw response.error;
      toast.success('Test email sent successfully');
    } catch (error: any) {
      toast.error('Test failed: ' + error.message);
    }
  };

  if (!profile?.is_admin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You need administrator privileges to configure SMTP relay protocols.
        </AlertDescription>
      </Alert>
    );
  }

  const relayEndpoint = `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/smtp-relay`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-6 w-6" />
        <h2 className="text-2xl font-bold">SMTP Relay Protocol</h2>
        <Badge variant="secondary">Enterprise</Badge>
      </div>

      <Tabs defaultValue="setup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="exchange">Exchange Config</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                SMTP Relay Configuration
              </CardTitle>
              <CardDescription>
                Configure your domain to process emails through the signature and banner system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain-select">Select Verified Domain</Label>
                <select
                  id="domain-select"
                  className="w-full p-2 border rounded-md"
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                >
                  <option value="">Select a domain...</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.domain_name}>
                      {domain.domain_name}
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                onClick={generateRelayConfig}
                disabled={!selectedDomain || isGenerating}
                className="w-full"
              >
                {isGenerating ? 'Generating...' : 'Generate SMTP Relay Configuration'}
              </Button>

              {relayConfig && (
                <div className="space-y-4 mt-6">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      SMTP Relay configured for domain: <strong>{relayConfig.domain}</strong>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Relay Endpoint</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={relayEndpoint}
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(relayEndpoint)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Relay Secret (Keep Secure)</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={relayConfig.relay_secret}
                        readOnly 
                        type="password"
                        className="font-mono text-sm"
                      />
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exchange">
          <Card>
            <CardHeader>
              <CardTitle>Exchange Server Configuration</CardTitle>
              <CardDescription>
                Configure Exchange to route emails through the SMTP relay
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  These steps require Exchange Administrator privileges
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">1. Create Send Connector</h3>
                <div className="bg-muted p-4 rounded-md">
                  <code className="text-sm whitespace-pre-line">
{`# PowerShell script to create Send Connector
New-SendConnector -Name "Email Manager Relay" \
  -Usage Custom \
  -AddressSpaces "${selectedDomain || 'your-domain.com'}:*" \
  -SmartHosts "${relayEndpoint.replace('https://', '')}" \
  -Port 443 \
  -RequireTLS $true \
  -SmartHostAuthMechanism BasicAuth \
  -AuthenticationCredential (Get-Credential)`}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => copyToClipboard(`New-SendConnector -Name "Email Manager Relay" -Usage Custom -AddressSpaces "${selectedDomain || 'your-domain.com'}:*" -SmartHosts "${relayEndpoint.replace('https://', '')}" -Port 443 -RequireTLS $true -SmartHostAuthMechanism BasicAuth -AuthenticationCredential (Get-Credential)`)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Script
                  </Button>
                </div>

                <h3 className="text-lg font-semibold">2. Create Transport Rule</h3>
                <div className="bg-muted p-4 rounded-md">
                  <code className="text-sm whitespace-pre-line">
{`# Transport Rule to route emails through relay
New-TransportRule -Name "Email Manager Processing" \
  -SenderDomainIs "${selectedDomain || 'your-domain.com'}" \
  -RouteMessageOutboundConnector "Email Manager Relay" \
  -Comments "Route emails through signature/banner system"`}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => copyToClipboard(`New-TransportRule -Name "Email Manager Processing" -SenderDomainIs "${selectedDomain || 'your-domain.com'}" -RouteMessageOutboundConnector "Email Manager Relay" -Comments "Route emails through signature/banner system"`)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Script
                  </Button>
                </div>

                <h3 className="text-lg font-semibold">3. Authentication Setup</h3>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    When prompted for credentials, use:
                  </p>
                  <div className="bg-muted p-4 rounded-md space-y-2">
                    <div className="flex justify-between">
                      <span>Username:</span>
                      <code>relay-auth</code>
                    </div>
                    <div className="flex justify-between">
                      <span>Password:</span>
                      <code>{relayConfig?.relay_secret.substring(0, 12)}...</code>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Test SMTP Relay
              </CardTitle>
              <CardDescription>
                Send a test email through the relay system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Test Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="user@your-domain.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </div>

              <Button 
                onClick={testRelay}
                disabled={!testEmail || !relayConfig}
                className="w-full"
              >
                Send Test Email
              </Button>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Test emails will be processed through the signature and banner system based on user assignments.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Monitoring & Logs</CardTitle>
              <CardDescription>
                Monitor relay performance and troubleshoot issues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Relay Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={relayConfig?.is_active ? "default" : "secondary"}>
                      {relayConfig?.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Domain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="font-mono text-sm">
                      {relayConfig?.domain || 'Not configured'}
                    </span>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Troubleshooting Steps</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Verify Exchange Send Connector is enabled</li>
                  <li>Check Transport Rule is active and properly configured</li>
                  <li>Ensure domain DNS records are properly configured</li>
                  <li>Verify relay secret matches in Exchange configuration</li>
                  <li>Check user assignments exist for test email addresses</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};