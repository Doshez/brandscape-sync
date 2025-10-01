import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, ExternalLink, Info } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SendGridSetupProps {
  relayConfig?: {
    relay_secret?: string;
  };
}

export const SendGridSetup = ({ relayConfig }: SendGridSetupProps) => {
  const { toast } = useToast();
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  const webhookUrl = `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/smtp-relay`;
  const relaySecret = relayConfig?.relay_secret || "Not configured";

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates({ ...copiedStates, [label]: true });
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => {
        setCopiedStates({ ...copiedStates, [label]: false });
      }, 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          SendGrid's Inbound Parse will process incoming emails and forward them through this webhook to add signatures and banners automatically.
        </AlertDescription>
      </Alert>

      {/* Step 1: Create SendGrid Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">1</span>
            Create SendGrid Account & Verify Domain
          </CardTitle>
          <CardDescription>
            Sign up for SendGrid and verify your domain for email processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm">
              1. Go to <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">SendGrid</a> and create an account
            </p>
            <p className="text-sm">
              2. Navigate to Settings → Sender Authentication
            </p>
            <p className="text-sm">
              3. Authenticate your domain by adding the provided DNS records
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.open("https://app.sendgrid.com/settings/sender_auth", "_blank")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open SendGrid Domain Settings
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Configure Inbound Parse */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">2</span>
            Configure SendGrid Inbound Parse
          </CardTitle>
          <CardDescription>
            Set up SendGrid to forward incoming emails to your webhook
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Navigate to Settings → Inbound Parse</p>
            <p className="text-sm">Add a new host and webhook with these details:</p>
          </div>

          <div className="space-y-4 rounded-lg bg-muted p-4">
            <div>
              <label className="text-sm font-medium">Subdomain:</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-sm">mail</code>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                You can use any subdomain (e.g., mail, inbound, relay)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Domain:</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-sm">yourdomain.com</code>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Use your verified domain
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Destination URL:</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-sm">{webhookUrl}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(webhookUrl, "Webhook URL")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Relay Secret (x-relay-secret header):</label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-sm">{relaySecret}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(relaySecret, "Relay Secret")}
                  disabled={relaySecret === "Not configured"}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Add this as a custom header in SendGrid webhook settings
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Check "POST the raw, full MIME message" option in SendGrid Inbound Parse settings
              </AlertDescription>
            </Alert>
          </div>

          <Button
            variant="outline"
            onClick={() => window.open("https://app.sendgrid.com/settings/parse", "_blank")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open SendGrid Inbound Parse Settings
          </Button>
        </CardContent>
      </Card>

      {/* Step 3: Configure MX Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">3</span>
            Configure MX Records
          </CardTitle>
          <CardDescription>
            Point your domain's MX records to SendGrid
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm">Add these MX records to your DNS provider:</p>
          </div>

          <div className="space-y-2 rounded-lg bg-muted p-4">
            <div className="grid grid-cols-3 gap-4 text-sm font-medium">
              <div>Priority</div>
              <div>Type</div>
              <div>Value</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>10</div>
              <div>MX</div>
              <div>mx.sendgrid.net</div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              These MX records will route incoming emails to SendGrid, which will then forward them to your webhook.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Step 4: Configure Exchange/Microsoft 365 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">4</span>
            Configure Exchange/Microsoft 365 SMTP
          </CardTitle>
          <CardDescription>
            Set up your email server to send through SendGrid
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You'll need SendGrid SMTP credentials. Go to Settings → API Keys in SendGrid to create an API key for SMTP.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm font-medium">Option 1: PowerShell (Recommended)</p>
            <div className="rounded-lg bg-muted p-4">
              <pre className="overflow-x-auto text-xs">
{`# Connect to Exchange Online
Connect-ExchangeOnline

# Configure SendGrid Connector
New-OutboundConnector -Name "SendGrid Relay" \`
  -ConnectorType OnPremises \`
  -SmartHosts smtp.sendgrid.net \`
  -TlsSettings EncryptionOnly \`
  -CloudServicesMailEnabled $true

# Requires configuring authentication in Exchange Admin Center`}
              </pre>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Option 2: Exchange Admin Center</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Go to Exchange Admin Center → Mail Flow → Connectors</li>
              <li>Create new connector: Office 365 to Partner organization</li>
              <li>Set smart host to: <code className="rounded bg-background px-1">smtp.sendgrid.net</code></li>
              <li>Configure authentication with your SendGrid API key</li>
            </ol>
          </div>

          <Button
            variant="outline"
            onClick={() => window.open("https://app.sendgrid.com/settings/api_keys", "_blank")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Create SendGrid API Key
          </Button>
        </CardContent>
      </Card>

      {/* Step 5: Test & Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">5</span>
            Test & Monitor
          </CardTitle>
          <CardDescription>
            Verify your setup and monitor webhook activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm">
              1. Send a test email to an address on your configured domain
            </p>
            <p className="text-sm">
              2. Check SendGrid Activity Feed for webhook delivery status
            </p>
            <p className="text-sm">
              3. Monitor Supabase edge function logs for processing details
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.open("https://app.sendgrid.com/email_activity", "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              SendGrid Activity Feed
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open("https://supabase.com/dashboard/project/ddoihmeqpjjiumqndjgk/functions/smtp-relay/logs", "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Edge Function Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
