import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle, AlertCircle, Globe, Mail, Server, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailRoutingSetupProps {
  profile: any;
}

interface Domain {
  id: string;
  domain_name: string;
  is_verified: boolean;
}

interface RelayConfig {
  domain: string;
  relay_secret: string;
  is_active: boolean;
}

export const EmailRoutingSetup: React.FC<EmailRoutingSetupProps> = ({ profile }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [relayConfig, setRelayConfig] = useState<RelayConfig | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.is_admin) {
      fetchDomains();
      fetchRelayConfig();
    }
  }, [profile]);

  const fetchDomains = async () => {
    const { data } = await supabase
      .from('domains')
      .select('id, domain_name, is_verified')
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
      .maybeSingle();
    
    if (data) {
      setRelayConfig(data);
      setSelectedDomain(data.domain);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const createRoutingDomain = async () => {
    if (!selectedDomain) {
      toast.error('Please select a domain first');
      return;
    }

    setLoading(true);
    try {
      // Generate routing configuration
      const routingSecret = crypto.getRandomValues(new Uint8Array(32))
        .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

      // Check if config already exists
      const { data: existingConfig } = await supabase
        .from('smtp_relay_config')
        .select('id')
        .eq('domain', selectedDomain)
        .maybeSingle();

      if (existingConfig) {
        // Update existing config
        const { data, error } = await supabase
          .from('smtp_relay_config')
          .update({
            relay_secret: routingSecret,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('domain', selectedDomain)
          .select()
          .single();
        
        if (error) throw error;
        setRelayConfig(data);
      } else {
        // Deactivate all existing configs
        await supabase
          .from('smtp_relay_config')
          .update({ is_active: false })
          .eq('is_active', true);

        // Create new config
        const { data, error } = await supabase
          .from('smtp_relay_config')
          .insert({
            domain: selectedDomain,
            relay_secret: routingSecret,
            is_active: true
          })
          .select()
          .single();
        
        if (error) throw error;
        setRelayConfig(data);
      }

      toast.success('Email routing domain configured successfully');
    } catch (error: any) {
      toast.error('Failed to configure routing domain: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile?.is_admin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only administrators can configure email routing domains.
        </AlertDescription>
      </Alert>
    );
  }

  const smartHost = selectedDomain ? `smtp-relay.${selectedDomain}` : '';
  const relayEndpoint = 'ddoihmeqpjjiumqndjgk.supabase.co';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Email Routing Domain Setup
          </h2>
          <p className="text-muted-foreground">
            Configure your domain to route emails through the smart host system
          </p>
        </div>
      </div>

      {domains.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to have at least one verified domain before setting up email routing. 
            Please add and verify a domain in the Domain Manager first.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="setup">Domain Setup</TabsTrigger>
          <TabsTrigger value="dns">DNS Configuration</TabsTrigger>
          <TabsTrigger value="routing">Routing Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Configure Routing Domain
              </CardTitle>
              <CardDescription>
                Select a verified domain and configure it for email routing through the smart host
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
                  disabled={domains.length === 0}
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
                onClick={createRoutingDomain}
                disabled={!selectedDomain || loading || domains.length === 0}
                className="w-full"
              >
                {loading ? 'Configuring...' : 'Configure Email Routing'}
              </Button>

              {relayConfig && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email routing configured for domain: <strong>{relayConfig.domain}</strong>
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
                Add these DNS records to enable smart host routing for your domain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDomain ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a domain first to see the DNS configuration.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">CNAME Record (Required)</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`smtp-relay.${selectedDomain} CNAME ${relayEndpoint}`)}
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
                        <p className="font-mono">{relayEndpoint}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">MX Record (Optional - for direct routing)</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`10 ${smartHost}`)}
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
                        <p className="font-mono">MX</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <p className="font-mono">10 {smartHost}</p>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> DNS propagation can take up to 24 hours. 
                      Test your configuration after DNS records have propagated completely.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Smart Host Configuration</CardTitle>
              <CardDescription>
                Use these details to configure your email server or Exchange connector
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDomain || !relayConfig ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please configure a routing domain first to see the smart host details.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
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

                  <div className="space-y-2">
                    <Label>Authentication Credentials</Label>
                    <div className="p-3 bg-secondary rounded-md">
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

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                      📋 Configuration Summary
                    </h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Domain: {relayConfig.domain}</li>
                      <li>• Smart Host: {smartHost}</li>
                      <li>• Port: 587 (SMTP with STARTTLS)</li>
                      <li>• Authentication: Required</li>
                      <li>• Security: TLS encryption enforced</li>
                    </ul>
                  </div>

                  <Alert>
                    <ExternalLink className="h-4 w-4" />
                    <AlertDescription>
                      Use the Exchange Admin Center manual setup to create connectors and transport rules 
                      that will route emails through this smart host configuration.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};