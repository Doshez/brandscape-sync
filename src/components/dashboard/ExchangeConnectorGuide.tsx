import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const ExchangeConnectorGuide = () => {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  
  const projectRef = "ddoihmeqpjjiumqndjgk";
  const connectorUrl = `https://${projectRef}.supabase.co/functions/v1/exchange-connector-relay`;

  const copyToClipboard = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="space-y-6">
      <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
        <AlertDescription>
          <strong>⚠️ Important Architecture Note:</strong> Exchange Connectors require an SMTP endpoint (mail server), not an HTTP endpoint. 
          This approach requires setting up an SMTP relay service (like SendGrid Inbound Parse, Mailgun Routes, or a custom SMTP server) 
          that receives emails from Exchange and forwards them to our edge function. This is more complex than the Transport Rules method.
          <br/><br/>
          <strong>Recommended:</strong> For most users, we suggest using the "Exchange Transport Rules (Graph API)" method instead, 
          which is simpler to set up and doesn't require additional SMTP infrastructure.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Exchange Connector Setup Guide (Advanced)</CardTitle>
          <CardDescription>
            This method requires SMTP relay infrastructure. Only proceed if you have an SMTP service configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              <strong>Prerequisites:</strong> You need Exchange Online admin access, PowerShell with Exchange Online Management module, 
              and an SMTP relay service (SendGrid, Mailgun, or custom SMTP server) configured to forward to your edge function.
            </AlertDescription>
          </Alert>

          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Connect to Exchange Online PowerShell</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Open PowerShell as Administrator and run:
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`Install-Module -Name ExchangeOnlineManagement -Force
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName admin@yourdomain.com`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      "Install-Module -Name ExchangeOnlineManagement -Force\nImport-Module ExchangeOnlineManagement\nConnect-ExchangeOnline -UserPrincipalName admin@yourdomain.com",
                      1
                    )}
                  >
                    {copiedStep === 1 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Create Outbound Connector</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Create a connector to route emails through your SMTP relay service. Replace <code className="bg-muted px-1 py-0.5 rounded">smtp.your-relay.com</code> with your actual SMTP server address:
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
{`New-OutboundConnector -Name "SignatureConnector" \\
  -RecipientDomains * \\
  -SmartHosts "smtp.your-relay.com" \\
  -TlsSettings EncryptionOnly \\
  -UseMXRecord $false \\
  -CloudServicesMailEnabled $false \\
  -RouteAllMessagesViaOnPremises $false \\
  -Enabled $true`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      `New-OutboundConnector -Name "SignatureConnector" -RecipientDomains * -SmartHosts "smtp.your-relay.com" -TlsSettings EncryptionOnly -UseMXRecord $false -CloudServicesMailEnabled $false -RouteAllMessagesViaOnPremises $false -Enabled $true`,
                      2
                    )}
                  >
                    {copiedStep === 2 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Alert className="mt-3 border-orange-500">
                  <AlertDescription className="text-xs">
                    <strong>⚠️ Important:</strong> SmartHosts requires an SMTP server hostname (e.g., "smtp.sendgrid.net" or "smtp.mailgun.org"), NOT an HTTP URL. 
                    You must configure your SMTP relay service to forward emails to: <code className="bg-muted px-1 py-0.5 rounded">{connectorUrl}</code>
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                3
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Create Transport Rule</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Create a rule to route all outbound emails through the connector. First, get the connector identity:
                </p>
                <div className="relative mb-3">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`$connector = Get-OutboundConnector "SignatureConnector"`}
                  </pre>
                </div>
                <p className="text-sm text-muted-foreground mb-3">Then create the transport rule:</p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
{`New-TransportRule -Name "Route via Signature Connector" \\
  -FromScope InOrganization \\
  -SentToScope NotInOrganization \\
  -RouteMessageOutboundConnector $connector.Identity \\
  -Priority 0`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      `$connector = Get-OutboundConnector "SignatureConnector"\nNew-TransportRule -Name "Route via Signature Connector" -FromScope InOrganization -SentToScope NotInOrganization -RouteMessageOutboundConnector $connector.Identity -Priority 0`,
                      3
                    )}
                  >
                    {copiedStep === 3 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                4
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Verify Configuration</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Check that the connector and rule are active:
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`Get-OutboundConnector "SignatureConnector" | Format-List
Get-TransportRule "Route via Signature Connector" | Format-List`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      'Get-OutboundConnector "SignatureConnector" | Format-List\nGet-TransportRule "Route via Signature Connector" | Format-List',
                      4
                    )}
                  >
                    {copiedStep === 4 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                5
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Test the Setup</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Send a test email from Outlook to an external recipient and verify:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  <li>Email signature is appended correctly</li>
                  <li>Banner is prepended (if assigned)</li>
                  <li>CC/BCC recipients receive the email</li>
                  <li>Attachments are intact</li>
                  <li>Original sender address is preserved</li>
                </ul>
              </div>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              <strong>How it works:</strong> When users send emails, Exchange routes them to your SMTP relay → SMTP relay forwards to edge function → edge function adds signatures/banners → forwards via SendGrid preserving all recipients, attachments, and sender identity.
            </AlertDescription>
          </Alert>

          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
            <AlertDescription>
              <strong>💡 Simpler Alternative:</strong> Consider using the "Exchange Transport Rules (Graph API)" method instead. 
              It doesn't require SMTP infrastructure and is easier to maintain. Only use this Connector method if you specifically need SMTP-level routing.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <a 
                href="https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/use-connectors-to-configure-mail-flow/use-connectors-to-configure-mail-flow" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Exchange Connector Docs <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href={`https://supabase.com/dashboard/project/${projectRef}/functions/exchange-connector-relay/logs`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Edge Function Logs <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Emails not being modified</h4>
            <p className="text-sm text-muted-foreground">
              Check edge function logs for errors. Ensure user has an active signature/banner assignment in User Assignment Manager.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">Connector fails to connect</h4>
            <p className="text-sm text-muted-foreground">
              Verify the edge function URL is correct and publicly accessible. Check if SENDGRID_API_KEY is configured in edge function secrets.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">Emails delayed or stuck</h4>
            <p className="text-sm text-muted-foreground">
              Check Exchange message trace and edge function logs. Ensure SendGrid API key has sufficient sending quota.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
