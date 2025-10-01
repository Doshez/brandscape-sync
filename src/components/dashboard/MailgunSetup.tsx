import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface MailgunSetupProps {
  relayConfig: {
    relay_secret: string;
  } | null;
}

export const MailgunSetup: React.FC<MailgunSetupProps> = ({ relayConfig }) => {
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  
  const projectId = "ddoihmeqpjjiumqndjgk";
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/smtp-relay`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates({ ...copiedStates, [key]: true });
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedStates({ ...copiedStates, [key]: false }), 2000);
  };

  const exchangeSmtpConfig = {
    smtpServer: "smtp.mailgun.org",
    port: "587",
    username: "Your Mailgun SMTP username",
    password: "Your Mailgun SMTP password"
  };

  const powershellScript = `# Configure Office 365 to route emails through Mailgun
$UserCredential = Get-Credential
Connect-ExchangeOnline -UserPrincipalName admin@yourdomain.com -Credential $UserCredential

# Create a new connector to Mailgun
New-OutboundConnector -Name "MailgunRelay" \\
  -ConnectorType OnPremises \\
  -UseMxRecord $false \\
  -SmartHosts smtp.mailgun.org \\
  -TlsSettings DomainValidation \\
  -IsTransportRuleScoped $false

# Create transport rule to route all emails through Mailgun
New-TransportRule -Name "RouteToMailgun" \\
  -FromScope InOrganization \\
  -RouteMessageOutboundConnector "MailgunRelay"`;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <strong>Architecture Overview:</strong> Exchange/Microsoft 365 sends emails via SMTP to Mailgun → 
          Mailgun processes and forwards to your Supabase edge function via webhook → 
          Edge function adds signatures/banners → Email is sent to final recipients.
        </AlertDescription>
      </Alert>

      {/* Step 1: Mailgun Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">1</span>
            Create Mailgun Account
          </CardTitle>
          <CardDescription>Sign up and verify your domain with Mailgun</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm">Go to Mailgun and create an account:</p>
            <Button 
              variant="outline" 
              onClick={() => window.open('https://signup.mailgun.com/new/signup', '_blank')}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Sign Up for Mailgun
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Add and verify your domain:</p>
            <Button 
              variant="outline" 
              onClick={() => window.open('https://app.mailgun.com/domains/new', '_blank')}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Add Domain in Mailgun
            </Button>
            <p className="text-xs text-muted-foreground">
              Follow Mailgun's instructions to add DNS records for domain verification
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Configure Mailgun Routes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">2</span>
            Configure Mailgun Route (Webhook)
          </CardTitle>
          <CardDescription>Set up Mailgun to forward emails to your Supabase function</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, 'webhook')}
              >
                {copiedStates['webhook'] ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {relayConfig && (
            <div className="space-y-2">
              <Label>Relay Secret (use as custom header)</Label>
              <div className="flex gap-2">
                <Input value={relayConfig.relay_secret} readOnly type="password" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(relayConfig.relay_secret, 'secret')}
                >
                  {copiedStates['secret'] ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add this as a custom header: <code>x-relay-secret</code>
              </p>
            </div>
          )}

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Mailgun Route Configuration:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Go to <a href="https://app.mailgun.com/routes" target="_blank" rel="noopener noreferrer" className="text-primary underline">Mailgun Routes</a></li>
              <li>Click "Create Route"</li>
              <li>Expression type: <strong>Match Recipient</strong></li>
              <li>Expression: <code>match_recipient(".*")</code> (all emails)</li>
              <li>Actions: Select <strong>Forward</strong></li>
              <li>Destination URL: Paste the webhook URL above</li>
              <li>Add custom header: <code>x-relay-secret</code> with the relay secret value</li>
              <li>Priority: 0 (highest)</li>
              <li>Click "Create Route"</li>
            </ol>
          </div>

          <Button 
            variant="outline" 
            onClick={() => window.open('https://app.mailgun.com/routes', '_blank')}
            className="w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Mailgun Routes
          </Button>
        </CardContent>
      </Card>

      {/* Step 3: Get SMTP Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">3</span>
            Get Mailgun SMTP Credentials
          </CardTitle>
          <CardDescription>Retrieve your SMTP credentials from Mailgun</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm">SMTP Server: <strong>smtp.mailgun.org</strong></p>
            <p className="text-sm">Port: <strong>587</strong> (TLS/STARTTLS)</p>
          </div>

          <Button 
            variant="outline" 
            onClick={() => window.open('https://app.mailgun.com/sending/domains', '_blank')}
            className="w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Get SMTP Credentials from Mailgun
          </Button>

          <p className="text-xs text-muted-foreground">
            Select your domain → Go to "Domain Settings" → Find "SMTP Credentials" section
          </p>
        </CardContent>
      </Card>

      {/* Step 4: Configure Exchange/Microsoft 365 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">4</span>
            Configure Exchange/Microsoft 365
          </CardTitle>
          <CardDescription>Set up Exchange to send emails through Mailgun</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>PowerShell Script (Run as Administrator)</Label>
            <div className="relative">
              <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                <code>{powershellScript}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(powershellScript, 'powershell')}
              >
                {copiedStates['powershell'] ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Note:</strong> Update the script with your actual Mailgun SMTP credentials before running.
              You'll need Exchange Online PowerShell module installed and admin access.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm font-medium">Manual Configuration (Exchange Admin Center):</p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Go to <strong>Mail flow</strong> → <strong>Connectors</strong></li>
              <li>Create new <strong>Outbound Connector</strong></li>
              <li>Name: "Mailgun SMTP Relay"</li>
              <li>Connection security: <strong>TLS</strong></li>
              <li>Smart host: <code>smtp.mailgun.org</code></li>
              <li>Port: <strong>587</strong></li>
              <li>Add your Mailgun SMTP credentials</li>
              <li>Create a <strong>Transport Rule</strong> to route emails through this connector</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">5</span>
            Test Your Setup
          </CardTitle>
          <CardDescription>Send a test email to verify everything works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Send a test email from your Exchange/Microsoft 365 account. Check:
              <ul className="mt-2 space-y-1 list-disc list-inside text-sm">
                <li>Mailgun logs show the email was received</li>
                <li>Supabase edge function logs show processing</li>
                <li>Email signature and banner are added</li>
                <li>Recipient receives the email</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.open('https://app.mailgun.com/logs', '_blank')}
              className="flex-1"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Mailgun Logs
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.open(`https://supabase.com/dashboard/project/${projectId}/functions/smtp-relay/logs`, '_blank')}
              className="flex-1"
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