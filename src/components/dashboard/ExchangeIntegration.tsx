import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
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

  const handleConnectExchange = async () => {
    setIsConnecting(true);
    
    try {
      // For demo purposes - in production, this should be properly configured
      const clientId = "your-actual-client-id-here"; // Replace with your actual Client ID
      
      if (!clientId || clientId === "your-actual-client-id-here") {
        toast({
          title: "Configuration Required",
          description: "Please complete the Microsoft Graph API setup first. See the Setup tab for instructions.",
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
      
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}&` +
        `response_mode=query`;
      
      // Open authorization URL
      window.location.href = authUrl;
    } catch (error) {
      console.error("Exchange connection error:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Microsoft Exchange. Please try again.",
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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="connection">Connection</TabsTrigger>
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
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      To use this feature, you need to connect your Microsoft Exchange account. 
                      This will allow automatic deployment of email signatures to users' mailboxes.
                      Make sure you've completed the setup process first.
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={handleConnectExchange}
                    disabled={isConnecting}
                    size="lg"
                  >
                    {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Connect Microsoft Exchange
                  </Button>
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
        
        <TabsContent value="setup" className="space-y-4">
          <MicrosoftAuthSetup />
        </TabsContent>
      </Tabs>
    </div>
  );
};