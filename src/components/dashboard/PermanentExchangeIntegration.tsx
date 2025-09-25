import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ExternalLink, CheckCircle, AlertCircle, Unlink, RefreshCw, Users, Settings, Trash2, Copy, Globe, Terminal } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MicrosoftAuthSetup } from "./MicrosoftAuthSetup";
import { MicrosoftSecretsManager } from "./MicrosoftSecretsManager";
import { ExchangeConnectionTester } from "./ExchangeConnectionTester";

interface ExchangeConnection {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  token_expires_at: string;
  created_at: string;
  access_token: string;
  refresh_token: string;
}

interface PermanentExchangeIntegrationProps {
  profile: any;
}

export const PermanentExchangeIntegration = ({ profile }: PermanentExchangeIntegrationProps) => {
  const [connections, setConnections] = useState<ExchangeConnection[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string>(() => 
    localStorage.getItem('microsoft_client_id') || ''
  );
  
  // DNS and Transport Rule Configuration
  const [domain, setDomain] = useState('');
  const [ruleName, setRuleName] = useState('Auto-Signature-Rule');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedSignature, setSelectedSignature] = useState('');
  const [selectedBanner, setSelectedBanner] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState<any>(null);
  
  // Data for dropdowns
  const [users, setUsers] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    fetchConnections();
    fetchConfigurationData();
    
    // Check for auth callback on component mount
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
      window.history.replaceState({}, document.title, "/dashboard");
      return;
    }
    
    if (code && state && state === storedState) {
      localStorage.removeItem('microsoft_auth_state');
      handleAuthCallback(code);
    }
  }, []);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      let query = supabase.from("exchange_connections").select("*");
      
      // Admins can see all connections, users only their own
      if (!profile?.is_admin) {
        query = query.eq("user_id", profile?.user_id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setConnections(data || []);
    } catch (error) {
      console.error("Error fetching connections:", error);
      toast({
        title: "Error",
        description: "Failed to fetch Exchange connections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigurationData = async () => {
    if (!profile?.is_admin) return;
    
    setLoadingData(true);
    try {
      // Fetch users, signatures, and banners in parallel
      const [usersResult, signaturesResult, bannersResult] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, email, department").order("first_name"),
        supabase.from("email_signatures").select("id, template_name, signature_type, department").eq("is_active", true).order("template_name"),
        supabase.from("banners").select("id, name, is_active").eq("is_active", true).order("name")
      ]);

      if (usersResult.error) throw usersResult.error;
      if (signaturesResult.error) throw signaturesResult.error;
      if (bannersResult.error) throw bannersResult.error;

      setUsers(usersResult.data || []);
      setSignatures(signaturesResult.data || []);
      setBanners(bannersResult.data || []);
    } catch (error) {
      console.error("Error fetching configuration data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch configuration data",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleConnectExchange = async () => {
    setIsConnecting(true);
    
    try {
      if (!clientId || clientId.trim() === '') {
        toast({
          title: "Client ID Required",
          description: "Please configure your Microsoft Client ID first.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      // Validate Client ID format
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!guidRegex.test(clientId.trim())) {
        toast({
          title: "Invalid Client ID Format",
          description: "Client ID should be in GUID format",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }
      
      // Generate state parameter for security
      const state = crypto.randomUUID();
      localStorage.setItem('microsoft_auth_state', state);
      
      const redirectUri = `${window.location.origin}/dashboard`;
      const scope = "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/MailboxSettings.ReadWrite https://graph.microsoft.com/User.Read offline_access";
      
      const authUrl = `https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?` +
        `client_id=${encodeURIComponent(clientId.trim())}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${encodeURIComponent(state)}&` +
        `response_mode=query&` +
        `prompt=consent`;
      
      window.location.href = authUrl;
    } catch (error) {
      console.error("Exchange connection error:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to initiate Microsoft Exchange connection.",
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

      // Store the permanent connection
      const { error: insertError } = await supabase
        .from('exchange_connections')
        .insert({
          user_id: profile?.user_id,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_expires_at: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
          microsoft_user_id: data.user.id,
          email: data.user.email,
          display_name: data.user.displayName,
          is_active: true
        });

      if (insertError) throw insertError;

      toast({
        title: "Connected Successfully",
        description: `Permanently connected to Microsoft Exchange as ${data.user.email}`,
      });

      // Clean up URL and refresh connections
      window.history.replaceState({}, document.title, "/dashboard");
      fetchConnections();
    } catch (error) {
      console.error("Auth callback error:", error);
      toast({
        title: "Authentication Failed",
        description: "Failed to establish permanent connection with Microsoft Exchange.",
        variant: "destructive",
      });
    }
  };

  const refreshConnection = async (connection: ExchangeConnection) => {
    setIsRefreshing(connection.id);
    
    try {
      // Use the edge function to refresh the connection
      const { data, error } = await supabase.functions.invoke('refresh-microsoft-token', {
        body: {
          connection_id: connection.id,
        },
      });

      if (error) throw error;

      toast({
        title: data.token_status === 'valid' ? "Connection Active" : "Connection Refreshed",
        description: data.message,
      });

      // Refresh the connections list to show updated status
      if (data.token_status === 'refreshed') {
        fetchConnections();
      }
    } catch (error: any) {
      console.error("Connection refresh error:", error);
      toast({
        title: "Refresh Failed",
        description: error.message || `Failed to refresh connection for ${connection.email}`,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(null);
    }
  };

  const disconnectExchange = async (connection: ExchangeConnection) => {
    if (!confirm(`Are you sure you want to permanently remove ${connection.email}? This will delete the connection completely.`)) return;

    try {
      const { error } = await supabase
        .from('exchange_connections')
        .delete()
        .eq('id', connection.id);

      if (error) throw error;

      toast({
        title: "Connection Removed",
        description: `Permanently removed connection for ${connection.email}`,
      });

      fetchConnections();
    } catch (error: any) {
      toast({
        title: "Remove Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const reactivateConnection = async (connection: ExchangeConnection) => {
    try {
      const { error } = await supabase
        .from('exchange_connections')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', connection.id);

      if (error) throw error;

      toast({
        title: "Connection Reactivated",
        description: `Reactivated connection for ${connection.email}`,
      });

      fetchConnections();
    } catch (error: any) {
      toast({
        title: "Reactivation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveClientId = () => {
    if (clientId.trim()) {
      localStorage.setItem('microsoft_client_id', clientId.trim());
      toast({
        title: "Configuration Saved",
        description: "Microsoft Client ID has been saved.",
      });
    }
  };

  const generateTransportRuleConfig = async () => {
    if (!domain || (!selectedSignature && !selectedBanner)) {
      toast({
        title: "Missing Information",
        description: "Please provide domain and select at least one signature or banner",
        variant: "destructive",
      });
      return;
    }

    if (selectedUsers.length === 0) {
      toast({
        title: "No Users Selected",
        description: "Please select at least one user",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Get selected signature HTML
      let signatureHtml = '';
      if (selectedSignature) {
        const signature = signatures.find(s => s.id === selectedSignature);
        if (signature) {
          const { data: sigData } = await supabase
            .from('email_signatures')
            .select('html_content')
            .eq('id', selectedSignature)
            .single();
          signatureHtml = sigData?.html_content || '';
        }
      }

      // Get selected banner HTML
      let bannerHtml = '';
      if (selectedBanner) {
        const { data: bannerData } = await supabase
          .from('banners')
          .select('html_content')
          .eq('id', selectedBanner)
          .single();
        bannerHtml = bannerData?.html_content || '';
      }

      // Combine signature and banner HTML
      const combinedHtml = `${signatureHtml}${bannerHtml ? '<br/>' + bannerHtml : ''}`.trim();

      // Get selected user emails
      const selectedUserEmails = users.filter(user => selectedUsers.includes(user.user_id)).map(user => user.email);

      const { data, error } = await supabase.functions.invoke('setup-exchange-transport-rules', {
        body: {
          domain: domain.trim(),
          signature_html: combinedHtml,
          rule_name: ruleName.trim(),
          user_emails: selectedUserEmails,
          selected_signature_id: selectedSignature,
          selected_banner_id: selectedBanner,
          target_user_ids: selectedUsers,
        },
      });

      if (error) throw error;

      setGeneratedConfig(data.configuration);
      toast({
        title: "Configuration Generated",
        description: "DNS records and PowerShell script have been generated",
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${type} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Exchange Integration</h3>
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
          <h3 className="text-lg font-medium">Permanent Exchange Integration</h3>
          <p className="text-muted-foreground">
            Manage persistent Microsoft Exchange connections for automatic signature deployment
          </p>
        </div>
        <Button onClick={fetchConnections} variant="outline">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="connections">Active Connections</TabsTrigger>
          <TabsTrigger value="setup">Setup & Connect</TabsTrigger>
          <TabsTrigger value="advanced">DNS & Transport</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="connections" className="space-y-4">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ExternalLink className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="text-lg font-medium mb-2">No Exchange connections</h4>
                <p className="text-muted-foreground mb-4">
                  Connect to Microsoft Exchange to enable automatic signature deployment.
                </p>
                <Button onClick={() => {
                  // Switch to setup tab
                  const setupTab = document.querySelector('[value="setup"]') as HTMLElement;
                  setupTab?.click();
                }}>
                  Set Up Connection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <Card key={connection.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <ExternalLink className="h-5 w-5" />
                          <span>{connection.display_name}</span>
                          {connection.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {connection.email} • Connected {new Date(connection.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>

                      <div className="flex items-center space-x-2">
                        {connection.is_active ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => refreshConnection(connection)}
                              disabled={isRefreshing === connection.id}
                            >
                              {isRefreshing === connection.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disconnectExchange(connection)}
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => reactivateConnection(connection)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Reactivate
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => disconnectExchange(connection)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Auto-deployment enabled</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span>Token expires: {new Date(connection.token_expires_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="setup" className="space-y-4">
          {profile?.is_admin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Microsoft App Configuration
                </CardTitle>
                <CardDescription>
                  Configure Microsoft application credentials for Exchange integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MicrosoftSecretsManager />
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Connect Microsoft Exchange
              </CardTitle>
              <CardDescription>
                Set up a permanent connection to Microsoft Exchange for automatic signature deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    Save
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Permanent Connection:</strong> Once established, this connection will persist 
                  and automatically refresh tokens as needed. Signatures can be deployed to all 
                  connected accounts without requiring users to re-authenticate.
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
            </CardContent>
          </Card>

          <MicrosoftAuthSetup />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                DNS & Transport Rule Configuration
              </CardTitle>
              <CardDescription>
                Generate DNS records and Exchange transport rules for automatic signature deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ruleName">Transport Rule Name</Label>
                  <Input
                    id="ruleName"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="Auto-Signature-Rule"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Users</Label>
                {loadingData ? (
                  <div className="text-sm text-muted-foreground">Loading users...</div>
                ) : (
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="selectAll"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers(users.map(u => u.user_id));
                          } else {
                            setSelectedUsers([]);
                          }
                        }}
                        className="rounded"
                      />
                      <label htmlFor="selectAll" className="text-sm font-medium">
                        Select All ({users.length} users)
                      </label>
                    </div>
                    {users.map((user) => (
                      <div key={user.user_id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={user.user_id}
                          checked={selectedUsers.includes(user.user_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.user_id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.user_id));
                            }
                          }}
                          className="rounded"
                        />
                        <label htmlFor={user.user_id} className="text-sm flex-1">
                          {user.first_name} {user.last_name} ({user.email})
                          {user.department && <span className="text-muted-foreground"> - {user.department}</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signature">Email Signature</Label>
                  <select
                    id="signature"
                    value={selectedSignature}
                    onChange={(e) => setSelectedSignature(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">No signature</option>
                    {signatures.map((signature) => (
                      <option key={signature.id} value={signature.id}>
                        {signature.template_name} ({signature.signature_type})
                        {signature.department && ` - ${signature.department}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="banner">Banner</Label>
                  <select
                    id="banner"
                    value={selectedBanner}
                    onChange={(e) => setSelectedBanner(e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                  >
                    <option value="">No banner</option>
                    {banners.map((banner) => (
                      <option key={banner.id} value={banner.id}>
                        {banner.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedUsers.length > 0 && (
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm">
                    <strong>Selected:</strong> {selectedUsers.length} users
                    {selectedSignature && <span>, 1 signature</span>}
                    {selectedBanner && <span>, 1 banner</span>}
                  </div>
                </div>
              )}

              <Button 
                onClick={generateTransportRuleConfig}
                disabled={isGenerating || !domain || selectedUsers.length === 0 || (!selectedSignature && !selectedBanner)}
                className="w-full"
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Configuration for {selectedUsers.length} Users
              </Button>
            </CardContent>
          </Card>

          {generatedConfig && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    DNS Records
                  </CardTitle>
                  <CardDescription>
                    Add these DNS records to your domain registrar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">Required Records:</h4>
                    {generatedConfig.dns_records.required_records.map((record: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{record.type}</Badge>
                            <span className="font-medium">{record.name}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(record.value, `${record.type} record`)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-sm font-mono bg-muted p-2 rounded">
                          {record.value}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {record.description}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Optional Records (DKIM):</h4>
                    {generatedConfig.dns_records.optional_records.map((record: any, index: number) => (
                      <div key={index} className="border rounded-lg p-3 space-y-2 opacity-60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{record.type}</Badge>
                            <span className="font-medium">{record.name}</span>
                          </div>
                        </div>
                        <div className="text-sm font-mono bg-muted p-2 rounded">
                          {record.value}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {record.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    PowerShell Transport Rule
                  </CardTitle>
                  <CardDescription>
                    Run this PowerShell script in Exchange Online PowerShell
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                      <code>{generatedConfig.powershell_script}</code>
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(generatedConfig.powershell_script, "PowerShell script")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Setup Instructions:</strong>
                      <ol className="list-decimal list-inside mt-2 space-y-1">
                        {generatedConfig.setup_instructions.map((instruction: string, index: number) => (
                          <li key={index}>{instruction}</li>
                        ))}
                      </ol>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-4">
          <ExchangeConnectionTester />
        </TabsContent>
      </Tabs>

      {profile?.is_admin && connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Organization Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{connections.length}</div>
                <div className="text-sm text-muted-foreground">Total Connections</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {connections.filter(c => c.is_active).length}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {connections.filter(c => new Date(c.token_expires_at) > new Date()).length}
                </div>
                <div className="text-sm text-muted-foreground">Valid Tokens</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {[...new Set(connections.map(c => c.email.split('@')[1]))].length}
                </div>
                <div className="text-sm text-muted-foreground">Domains</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};