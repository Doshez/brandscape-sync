import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, CheckCircle, AlertCircle, Unlink, RefreshCw, Users, Settings } from "lucide-react";
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

  useEffect(() => {
    fetchConnections();
    
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
      const scope = "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access";
      
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
    if (!confirm(`Are you sure you want to disconnect ${connection.email}?`)) return;

    try {
      const { error } = await supabase
        .from('exchange_connections')
        .update({ is_active: false })
        .eq('id', connection.id);

      if (error) throw error;

      toast({
        title: "Disconnected",
        description: `Disconnected from ${connection.email}`,
      });

      fetchConnections();
    } catch (error: any) {
      toast({
        title: "Disconnect Failed",
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="connections">Active Connections</TabsTrigger>
          <TabsTrigger value="setup">Setup & Connect</TabsTrigger>
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