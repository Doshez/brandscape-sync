import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Key, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const MicrosoftSecretsManager = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [validationResults, setValidationResults] = useState<any[]>([]);

  const validateAndUpdateSecrets = async () => {
    if (!clientId.trim() && !clientSecret.trim()) {
      toast({
        title: "Input Required",
        description: "Please provide at least one credential to update.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    setValidationResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('update-microsoft-secrets', {
        body: {
          client_id: clientId.trim() || undefined,
          client_secret: clientSecret.trim() || undefined,
        },
      });

      if (error) throw error;

      setValidationResults(data.results || []);

      toast({
        title: "Validation Complete",
        description: data.message,
      });

      // Clear the form on success
      setClientId("");
      setClientSecret("");

    } catch (error: any) {
      console.error("Secrets update error:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update Microsoft credentials",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const updateClientSecret = () => {
    // This will trigger the secrets update modal
    if (window.confirm("This will open the Supabase secrets manager. Continue?")) {
      // For now, we'll use the secrets tool
      toast({
        title: "Manual Update Required",
        description: "Please update the MICROSOFT_CLIENT_SECRET in Supabase Edge Functions settings.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newClientId" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Microsoft Client ID
          </Label>
          <Input
            id="newClientId"
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="font-mono"
          />
          <p className="text-sm text-muted-foreground">
            Application (client) ID from Azure App Registration
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="newClientSecret" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Microsoft Client Secret
          </Label>
          <Input
            id="newClientSecret"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Enter client secret value (not ID)"
            className="font-mono"
          />
          <p className="text-sm text-muted-foreground">
            Client secret value from Azure App Registration
          </p>
        </div>

        <Button 
          onClick={validateAndUpdateSecrets}
          disabled={isUpdating || (!clientId.trim() && !clientSecret.trim())}
          className="w-full"
        >
          {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Validate & Update Credentials
        </Button>
      </div>

      {validationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Validation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {validationResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-mono">{result.secret}</span>
                </div>
                <span className="text-xs text-muted-foreground">{result.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Quick Actions
        </h4>
        
        <div className="grid grid-cols-1 gap-2">
          <Button 
            onClick={updateClientSecret}
            variant="outline"
            size="sm"
            className="justify-start"
          >
            <Key className="h-4 w-4 mr-2" />
            Update Client Secret Only
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Note:</strong> These credentials are stored as encrypted secrets in Supabase. 
          Changes require manual confirmation in the Edge Functions settings. Never share these credentials 
          or store them in client-side code.
        </AlertDescription>
      </Alert>
    </div>
  );
};