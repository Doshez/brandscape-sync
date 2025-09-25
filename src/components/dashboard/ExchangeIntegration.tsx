import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, CheckCircle, AlertCircle, Save, Copy, Server, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MicrosoftAuthSetup } from "./MicrosoftAuthSetup";

interface ExchangeUser {
  email: string;
  displayName: string;
  id: string;
  access_token: string;
  connected_at: string;
}

interface ExchangeIntegrationProps {
  onUserConnected?: (user: ExchangeUser) => void;
}

export const ExchangeIntegration = ({ onUserConnected }: ExchangeIntegrationProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedUser, setConnectedUser] = useState<ExchangeUser | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [clientId, setClientId] = useState<string>(() => 
    localStorage.getItem('microsoft_client_id') || ''
  );
  
  // Advanced setup state
  const [domain, setDomain] = useState('');
  const [signatureHtml, setSignatureHtml] = useState('');
  const [ruleName, setRuleName] = useState('Auto-Signature-Rule');
  const [userEmails, setUserEmails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<any>(null);

  const handleConnectExchange = async () => {
    setIsConnecting(true);
    
    try {
      if (!clientId || clientId.trim() === '') {
        toast({
          title: "Client ID Required",
          description: "Please enter your Microsoft Client ID in the Connection tab first.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Validate Client ID format (should be a GUID)
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!guidRegex.test(clientId.trim())) {
        toast({
          title: "Invalid Client ID Format",
          description: "Client ID should be in GUID format (e.g., 12345678-1234-1234-1234-123456789012)",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }
      
      // Generate state parameter for security
      const state = crypto.randomUUID();
      localStorage.setItem('microsoft_auth_state', state);
      
      const redirectUri = `${window.location.origin}/dashboard`;
      const scope = "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access";
      
      // Log the configuration for debugging
      console.log('Microsoft OAuth Configuration:', {
        clientId: clientId.trim(),
        redirectUri,
        scope,
        state
      });
      
      const authUrl = `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?` +
        `client_id=${encodeURIComponent(clientId.trim())}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${encodeURIComponent(state)}&` +
        `response_mode=query&` +
        `prompt=consent`;
      
      console.log('Auth URL:', authUrl);
      
      // Open authorization URL
      window.location.href = authUrl;
    } catch (error) {
      console.error("Exchange connection error:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Microsoft Exchange. Please check the console for details.",
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleAuthCallback = async (code: string) => {
    try {
      const redirectUri = `${window.location.origin}/dashboard`;
      
      const { data, error } = await supabase.functions.invoke('microsoft-graph-auth', {
        body: {
          code,
          redirect_uri: redirectUri,
        },
      });

      if (error) throw error;

      const user: ExchangeUser = {
        email: data.user.email,
        displayName: data.user.displayName,
        id: data.user.id,
        access_token: data.access_token,
        connected_at: new Date().toISOString(),
      };

      setConnectedUser(user);
      onUserConnected?.(user);
      
      toast({
        title: "Connected Successfully",
        description: `Connected to Microsoft Exchange as ${user.email}`,
      });

      // Clean up URL
      window.history.replaceState({}, document.title, "/dashboard");
    } catch (error) {
      console.error("Auth callback error:", error);
      toast({
        title: "Authentication Failed",
        description: "Failed to authenticate with Microsoft Exchange. Please check your setup and try again.",
        variant: "destructive",
      });
    }
  };

  const deploySignature = async (signatureHtml: string) => {
    if (!connectedUser) return;
    
    setIsDeploying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('deploy-signature', {
        body: {
          access_token: connectedUser.access_token,
          signature_html: signatureHtml,
          user_email: connectedUser.email,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Signature Deployed",
          description: `Email signature successfully deployed to ${connectedUser.email}`,
        });
      } else {
        throw new Error(data.error || "Deployment failed");
      }
    } catch (error: any) {
      console.error("Signature deployment error:", error);
      toast({
        title: "Deployment Failed",
        description: "Failed to deploy signature to Exchange. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Check for auth callback on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const storedState = localStorage.getItem('microsoft_auth_state');
    
    if (error) {
      toast({
        title: "Microsoft Authentication Failed",
        description: errorDescription || `Authentication failed: ${error}`,
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, document.title, "/dashboard");
      return;
    }
    
    if (code && state && state === storedState) {
      localStorage.removeItem('microsoft_auth_state');
      handleAuthCallback(code);
    }
  }, []);

  const saveClientId = () => {
    if (clientId.trim()) {
      localStorage.setItem('microsoft_client_id', clientId.trim());
      toast({
        title: "Configuration Saved",
        description: "Microsoft Client ID has been saved. You can now connect to Exchange.",
      });
    }
  };

  const generateTransportRuleConfig = async () => {
    if (!domain || !signatureHtml || !ruleName) {
      toast({
        title: "Missing Information",
        description: "Please fill in domain, signature HTML, and rule name.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const emailArray = userEmails 
        ? userEmails.split(',').map(email => email.trim()).filter(email => email)
        : undefined;

      const { data, error } = await supabase.functions.invoke('setup-exchange-transport-rules', {
        body: {
          domain: domain.trim(),
          signature_html: signatureHtml,
          rule_name: ruleName.trim(),
          user_emails: emailArray
        },
      });

      if (error) throw error;

      setGeneratedConfig(data.configuration);
      toast({
        title: "Configuration Generated",
        description: "DNS records and transport rule configuration have been generated successfully.",
      });
    } catch (error: any) {
      console.error("Transport rule generation error:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate transport rule configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${label} has been copied to your clipboard.`,
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="advanced">DNS & Transport</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
        </TabsList>
        
        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Microsoft Exchange Integration
              </CardTitle>
              <CardDescription>
                Connect to Microsoft Exchange to automatically deploy email signatures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!connectedUser ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="clientId">Microsoft Client ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="clientId"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="Enter your Microsoft Application (Client) ID"
                        className="flex-1"
                      />
                      <Button 
                        onClick={saveClientId}
                        variant="outline"
                        disabled={!clientId.trim()}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get this from your Azure Portal app registration
                    </p>
                  </div>

                  <div className="bg-muted p-3 rounded-lg space-y-2">
                    <h4 className="text-sm font-medium">Configuration Check</h4>
                    <div className="text-xs space-y-1">
                      <p><strong>Current Redirect URI:</strong></p>
                      <code className="bg-background px-2 py-1 rounded text-xs break-all">
                        {window.location.origin}/dashboard
                      </code>
                      <p className="text-muted-foreground mt-2">
                        ⚠️ Make sure this EXACT URI is added to "Redirect URIs" in your Azure Portal app registration
                      </p>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Common Issue:</strong> If you get "refused to connect", verify that:
                      <br />• The redirect URI above matches exactly in Azure Portal
                      <br />• Your app registration allows "Web" platform
                      <br />• The Client ID is correct (36 characters with dashes)
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={handleConnectExchange}
                    disabled={isConnecting || !clientId.trim()}
                    size="lg"
                    className="w-full"
                  >
                    {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Connect Microsoft Exchange
                  </Button>

                  <div className="pt-2 border-t">
                    <Button 
                      onClick={() => {
                        if (!clientId.trim()) {
                          toast({
                            title: "Client ID Required",
                            description: "Please enter your Client ID first",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        const redirectUri = `${window.location.origin}/dashboard`;
                        const scope = "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access";
                        const state = crypto.randomUUID();
                        
                        const authUrl = `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?` +
                          `client_id=${encodeURIComponent(clientId.trim())}&` +
                          `response_type=code&` +
                          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                          `scope=${encodeURIComponent(scope)}&` +
                          `state=${encodeURIComponent(state)}&` +
                          `response_mode=query&` +
                          `prompt=consent`;
                        
                        // Copy URL to clipboard and show it
                        navigator.clipboard.writeText(authUrl);
                        toast({
                          title: "Debug URL Copied",
                          description: "The Microsoft auth URL has been copied to your clipboard. Open it in a new tab to see the exact error.",
                        });
                        
                        // Also log it to console
                        console.log('Microsoft Auth URL:', authUrl);
                        console.log('Redirect URI:', redirectUri);
                        console.log('Client ID:', clientId.trim());
                        
                        // Open in new tab
                        window.open(authUrl, '_blank');
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      🔍 Debug: Test Auth URL in New Tab
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      This will open the Microsoft login in a new tab and copy the URL to clipboard for debugging
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">{connectedUser.displayName}</p>
                        <p className="text-sm text-muted-foreground">{connectedUser.email}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Connected</Badge>
                  </div>
                  
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Exchange integration is active. You can now deploy signatures automatically 
                      from the Signature Manager.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                DNS Records & Transport Rules
              </CardTitle>
              <CardDescription>
                Generate DNS records and Exchange transport rules for automatic signature deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="domain">Company Domain</Label>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your organization's email domain
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="ruleName">Transport Rule Name</Label>
                  <Input
                    id="ruleName"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="Auto-Signature-Rule"
                  />
                  <p className="text-xs text-muted-foreground">
                    Name for the Exchange transport rule
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="userEmails">Target Users (Optional)</Label>
                <Input
                  id="userEmails"
                  value={userEmails}
                  onChange={(e) => setUserEmails(e.target.value)}
                  placeholder="user1@example.com, user2@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to apply to all users in the domain. Separate multiple emails with commas.
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="signatureHtml">Signature HTML</Label>
                <Textarea
                  id="signatureHtml"
                  value={signatureHtml}
                  onChange={(e) => setSignatureHtml(e.target.value)}
                  placeholder="<div>Your signature HTML here...</div>"
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  The HTML content for the email signature
                </p>
              </div>

              <Button 
                onClick={generateTransportRuleConfig}
                disabled={isGenerating || !domain || !signatureHtml || !ruleName}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Globe className="mr-2 h-4 w-4" />
                Generate DNS & Transport Rule Configuration
              </Button>

              {generatedConfig && (
                <div className="space-y-4 mt-6">
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      Required DNS Records
                    </h3>
                    
                    {generatedConfig.dns_records.required_records.map((record: any, index: number) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{record.type}</Badge>
                                <span className="font-mono text-sm">{record.name}</span>
                              </div>
                              <div className="bg-muted p-3 rounded-md">
                                <code className="text-sm break-all">{record.value}</code>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                {record.description}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(record.value, `${record.type} record`)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>DNS Setup Instructions:</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                          {generatedConfig.dns_records.setup_instructions.map((instruction: string, index: number) => (
                            <li key={index}>{instruction}</li>
                          ))}
                        </ol>
                      </AlertDescription>
                    </Alert>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Exchange Transport Rule Script
                      </h3>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <h4 className="font-medium">PowerShell Script</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(generatedConfig.powershell_script, "PowerShell script")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="bg-muted p-4 rounded-md overflow-x-auto">
                            <pre className="text-sm whitespace-pre-wrap font-mono">
                              {generatedConfig.powershell_script}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>

                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>PowerShell Setup Instructions:</strong>
                          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                            {generatedConfig.setup_instructions.map((instruction: string, index: number) => (
                              <li key={index}>{instruction}</li>
                            ))}
                          </ol>
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="setup" className="space-y-4">
          <MicrosoftAuthSetup />
        </TabsContent>
      </Tabs>
    </div>
  );
};