import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Info } from "lucide-react";

export const MicrosoftAuthSetup = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Microsoft Graph API Setup Required
        </CardTitle>
        <CardDescription>
          Complete these steps to enable Microsoft Exchange integration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Microsoft Exchange integration requires proper OAuth app registration in Azure Portal.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Step 1: Register Your App</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>1. Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                Azure Portal <ExternalLink className="h-3 w-3" />
              </a></p>
              <p>2. Click "New registration"</p>
              <p>3. Enter your app name (e.g., "Email Signature Manager")</p>
              <p><strong>4. CRITICAL:</strong> Set redirect URI type to <Badge variant="outline">Web</Badge></p>
              <p><strong>5. Set redirect URI to:</strong> <Badge variant="outline" className="font-mono text-xs">{window.location.origin}/dashboard</Badge></p>
              <p className="text-amber-600">⚠️ The redirect URI must match EXACTLY (including the protocol https://)</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 2: Configure API Permissions</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Add these Microsoft Graph <strong>Delegated</strong> permissions:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><Badge variant="outline">Mail.ReadWrite</Badge> - To manage email signatures</li>
                <li><Badge variant="outline">User.Read</Badge> - To read user profile</li>
                <li><Badge variant="outline">offline_access</Badge> - For refresh tokens</li>
              </ul>
              <p className="text-amber-600">⚠️ Remember to grant admin consent for these permissions</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 3: Get Your Credentials</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>1. Copy your <strong>Application (client) ID</strong> - it should look like: <code className="text-xs">12345678-1234-1234-1234-123456789012</code></p>
              <p>2. Go to "Certificates & secrets" and create a new client secret</p>
              <p>3. Copy the client secret value (you'll only see it once!)</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Step 4: Troubleshooting "Refused to Connect"</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>If you get "login.microsoftonline.com refused to connect":</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Verify the redirect URI in Azure matches: <code className="text-xs">{window.location.origin}/dashboard</code></li>
                <li>Ensure platform type is set to "Web" (not SPA)</li>
                <li>Check that your Client ID is in the correct GUID format</li>
                <li>Make sure the app registration is not restricted to specific tenants</li>
              </ul>
            </div>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> The Microsoft Graph API has limitations for email signature management. 
            Some Exchange configurations may not support programmatic signature updates.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};