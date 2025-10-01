import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle, AlertCircle, Mail, ExternalLink } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MailgunSetupProps {
  profile: any;
}

export const MailgunSetup: React.FC<MailgunSetupProps> = ({ profile }) => {
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('');

  useEffect(() => {
    if (profile?.is_admin) {
      fetchDomains();
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

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (!profile?.is_admin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You need administrator privileges to configure Mailgun integration.
        </AlertDescription>
      </Alert>
    );
  }

  const webhookUrl = `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/smtp-relay`;
  const mailgunSmtpHost = `smtp.mailgun.org`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Mail className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Mailgun SMTP Relay Setup</h2>
        <Badge variant="secondary">Recommended</Badge>
      </div>

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Mailgun provides a reliable SMTP relay service that works seamlessly with Microsoft 365/Exchange.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Set Up Mailgun Account</CardTitle>
          <CardDescription>
            Create and configure your Mailgun account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>
              Sign up for a Mailgun account at{' '}
              <a 
                href="https://signup.mailgun.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                mailgun.com
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              Add and verify your domain in Mailgun's dashboard
            </li>
            <li>
              Configure the required DNS records (SPF, DKIM, MX) for your domain
            </li>
            <li>
              Wait for Mailgun to verify your domain (usually takes a few minutes)
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 2: Configure Mailgun Webhook</CardTitle>
          <CardDescription>
            Set up the webhook to process emails through our system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Your Domain</Label>
            <select
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

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              In Mailgun dashboard, go to <strong>Sending → Routes</strong> and create a new route.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Route Expression Type</Label>
              <Input value="Match Recipient" readOnly className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Route Expression</Label>
              <div className="flex gap-2">
                <Input 
                  value={`.*@${selectedDomain || 'your-domain.com'}`}
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(`.*@${selectedDomain || 'your-domain.com'}`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This matches all emails for your domain
              </p>
            </div>

            <div className="space-y-2">
              <Label>Actions</Label>
              <div className="bg-muted p-3 rounded-md space-y-2">
                <p className="text-sm">Add these actions in order:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li><code>forward({webhookUrl})</code></li>
                  <li><code>stop()</code></li>
                </ol>
              </div>
              <div className="flex gap-2 mt-2">
                <Input 
                  value={webhookUrl}
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(webhookUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Input value="10" readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Lower numbers = higher priority
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 3: Configure Microsoft 365/Exchange</CardTitle>
          <CardDescription>
            Set up Exchange to send emails via Mailgun SMTP
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You'll need your Mailgun SMTP credentials from the Mailgun dashboard (Settings → SMTP credentials)
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-4 rounded-md space-y-2">
            <h4 className="font-semibold text-sm">SMTP Configuration Details:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>SMTP Host:</div>
              <code className="font-mono">{mailgunSmtpHost}</code>
              
              <div>Port:</div>
              <code className="font-mono">587 (TLS) or 465 (SSL)</code>
              
              <div>Username:</div>
              <code className="font-mono">postmaster@{selectedDomain || 'your-domain.com'}</code>
              
              <div>Password:</div>
              <code className="font-mono">[Your Mailgun SMTP password]</code>
            </div>
          </div>

          <div className="space-y-2">
            <Label>PowerShell Command for Exchange Admin Center</Label>
            <div className="bg-muted p-4 rounded-md">
              <code className="text-xs whitespace-pre-line">
{`# Create Send Connector for Mailgun
New-SendConnector -Name "Mailgun SMTP Relay" \\
  -Usage Custom \\
  -AddressSpaces "*" \\
  -SmartHosts "${mailgunSmtpHost}" \\
  -Port 587 \\
  -RequireTLS $true \\
  -SmartHostAuthMechanism BasicAuth \\
  -AuthenticationCredential (Get-Credential)

# Create Transport Rule
New-TransportRule -Name "Route via Mailgun" \\
  -SenderDomainIs "${selectedDomain || 'your-domain.com'}" \\
  -RouteMessageOutboundConnector "Mailgun SMTP Relay"`}
              </code>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => copyToClipboard(`New-SendConnector -Name "Mailgun SMTP Relay" -Usage Custom -AddressSpaces "*" -SmartHosts "${mailgunSmtpHost}" -Port 587 -RequireTLS $true -SmartHostAuthMechanism BasicAuth -AuthenticationCredential (Get-Credential)\n\nNew-TransportRule -Name "Route via Mailgun" -SenderDomainIs "${selectedDomain || 'your-domain.com'}" -RouteMessageOutboundConnector "Mailgun SMTP Relay"`)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Commands
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Step 4: Test Your Setup</CardTitle>
          <CardDescription>
            Verify everything is working correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>Send a test email from your Exchange/Microsoft 365 account</li>
            <li>Check Mailgun's dashboard for the email in the logs</li>
            <li>Verify the email was delivered with your signature and banner</li>
            <li>Check the recipient inbox to confirm proper formatting</li>
          </ol>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              If emails aren't being processed, check the Edge Function logs in the Supabase dashboard.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-900">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-900">
          <ul className="list-disc list-inside space-y-1">
            <li>Mailgun free tier has sending limits - check their pricing for your volume</li>
            <li>Make sure user email assignments are configured before testing</li>
            <li>DNS propagation for Mailgun can take up to 48 hours</li>
            <li>Keep your Mailgun SMTP credentials secure</li>
            <li>Monitor the Mailgun dashboard for delivery statistics</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
