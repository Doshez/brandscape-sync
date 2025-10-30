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
      <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
        <AlertDescription>
          <strong>🚀 SendGrid Inbound Parse Method:</strong> This method works like Rocketseed - emails flow through Exchange → SendGrid Inbound Parse → Edge Function → SendGrid outbound. 
          Your emails get signatures and banners added seamlessly without changing sender addresses.
          <br/><br/>
          <strong>Email Flow:</strong> User sends email → Exchange Outbound Connector → mail.cioafrica.co (MX to SendGrid) → SendGrid Inbound Parse webhook → Edge Function processes → SendGrid sends to recipient
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>SendGrid Inbound Parse + Exchange Connector Setup</CardTitle>
          <CardDescription>
            Complete setup guide for routing emails through SendGrid Inbound Parse to add signatures and banners
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              <strong>Prerequisites:</strong> SendGrid account with verified domain, Exchange Online admin access, DNS management access, and PowerShell with Exchange Online Management module installed.
            </AlertDescription>
          </Alert>

          {/* Step 1 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Add DNS MX Record</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Configure your DNS to point <code className="bg-muted px-1 py-0.5 rounded">mail.cioafrica.co</code> to SendGrid:
                </p>
                <div className="bg-muted p-4 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2">Type</th>
                        <th className="text-left py-2">Name</th>
                        <th className="text-left py-2">Value</th>
                        <th className="text-left py-2">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2">MX</td>
                        <td className="py-2">mail.cioafrica.co</td>
                        <td className="py-2 font-mono">mx.sendgrid.net</td>
                        <td className="py-2">10</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    <strong>⚠️ Do this FIRST:</strong> Add the MX record before configuring SendGrid Inbound Parse. Wait 5-10 minutes for DNS propagation. Verify with: <code className="bg-muted px-1 py-0.5 rounded">nslookup -type=mx mail.cioafrica.co</code>
                  </AlertDescription>
                </Alert>
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
                <h3 className="font-semibold mb-2">Configure SendGrid Inbound Parse</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Go to SendGrid Inbound Parse settings and configure:
                </p>
                <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
                  <div>
                    <strong>Subdomain:</strong> <code className="bg-background px-2 py-1 rounded ml-2">mail</code>
                  </div>
                  <div>
                    <strong>Domain:</strong> <code className="bg-background px-2 py-1 rounded ml-2">cioafrica.co</code>
                  </div>
                  <div>
                    <strong>Destination URL:</strong>
                    <code className="bg-background px-2 py-1 rounded block mt-1 break-all">
                      https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/smtp-relay
                    </code>
                  </div>
                  <div className="pt-2">
                    <strong>☑️ Check:</strong> "POST the raw, full MIME message"
                  </div>
                </div>
                <div className="mt-3">
                  <Button variant="outline" size="sm" asChild>
                    <a 
                      href="https://app.sendgrid.com/settings/parse" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Open SendGrid Inbound Parse <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    <strong>Note:</strong> Make sure you have disabled IP Access Management in SendGrid (Settings → Access Management → IP Access Management) because Supabase uses dynamic IPs.
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
                <h3 className="font-semibold mb-2">Connect to Exchange Online PowerShell</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Open PowerShell as Administrator and connect to Exchange Online:
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`Install-Module -Name ExchangeOnlineManagement -Force
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName admin@cioafrica.co`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      "Install-Module -Name ExchangeOnlineManagement -Force\nImport-Module ExchangeOnlineManagement\nConnect-ExchangeOnline -UserPrincipalName admin@cioafrica.co",
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
                <h3 className="font-semibold mb-2">Create Exchange Outbound Connector</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Create a connector that routes emails to mail.cioafrica.co (which SendGrid handles):
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
{`New-OutboundConnector -Name "SignatureConnector" \\
  -RecipientDomains * \\
  -SmartHosts "mail.cioafrica.co" \\
  -TlsSettings EncryptionOnly \\
  -UseMXRecord $true \\
  -CloudServicesMailEnabled $false \\
  -RouteAllMessagesViaOnPremises $false \\
  -Enabled $true`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      `New-OutboundConnector -Name "SignatureConnector" -RecipientDomains * -SmartHosts "mail.cioafrica.co" -TlsSettings EncryptionOnly -UseMXRecord $true -CloudServicesMailEnabled $false -RouteAllMessagesViaOnPremises $false -Enabled $true`,
                      4
                    )}
                  >
                    {copiedStep === 4 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    <strong>Key Setting:</strong> <code className="bg-muted px-1 py-0.5 rounded">-UseMXRecord $true</code> tells Exchange to use the MX record for mail.cioafrica.co (which points to SendGrid). This is how emails route: Exchange → mail.cioafrica.co MX lookup → mx.sendgrid.net → SendGrid Inbound Parse → Edge Function
                  </AlertDescription>
                </Alert>
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
                <h3 className="font-semibold mb-2">Create Transport Rule</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Create a transport rule to route outbound emails through the connector:
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
{`# Get the connector
$connector = Get-OutboundConnector "SignatureConnector"

if ($connector) {
    Write-Host "Connector found: $($connector.Name)"
    
    # Create transport rule
    New-TransportRule -Name "Route via Signature Connector" \\
      -FromScope InOrganization \\
      -SentToScope NotInOrganization \\
      -RouteMessageOutboundConnector $connector.Identity \\
      -Comments "Routes outbound emails through SendGrid signature service" \\
      -Priority 0
      
    Write-Host "Transport rule created successfully!"
} else {
    Write-Host "ERROR: Connector not found. Please create it first."
}`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      `$connector = Get-OutboundConnector "SignatureConnector"\n\nif ($connector) {\n    Write-Host "Connector found: $($connector.Name)"\n    \n    New-TransportRule -Name "Route via Signature Connector" -FromScope InOrganization -SentToScope NotInOrganization -RouteMessageOutboundConnector $connector.Identity -Comments "Routes outbound emails through SendGrid signature service" -Priority 0\n    \n    Write-Host "Transport rule created successfully!"\n} else {\n    Write-Host "ERROR: Connector not found. Please create it first."\n}`,
                      5
                    )}
                  >
                    {copiedStep === 5 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    <strong>Troubleshooting:</strong> If the connector is not found, wait 1-2 minutes for Exchange to sync after creating the connector, then run the command again. You can verify all connectors with: <code className="bg-muted px-1 py-0.5 rounded">Get-OutboundConnector | Format-Table Name, Identity</code>
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </div>

          {/* Step 6 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                6
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Verify Configuration</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Verify that both the connector and transport rule are active:
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
                      6
                    )}
                  >
                    {copiedStep === 6 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 7 */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                7
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
              <strong>🚀 How it works:</strong> User sends email → Exchange Outbound Connector → mail.cioafrica.co (DNS MX lookup) → mx.sendgrid.net → SendGrid Inbound Parse webhook → Edge Function (adds signatures/banners) → SendGrid outbound (sends to recipient) — Original sender, recipients, and attachments all preserved!
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" asChild>
              <a 
                href="https://app.sendgrid.com/settings/parse" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                SendGrid Inbound Parse <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href={`https://supabase.com/dashboard/project/${projectRef}/functions/smtp-relay/logs`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Edge Function Logs <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a 
                href="https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/use-connectors-to-configure-mail-flow/use-connectors-to-configure-mail-flow" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Exchange Connector Docs <ExternalLink className="ml-2 h-4 w-4" />
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
