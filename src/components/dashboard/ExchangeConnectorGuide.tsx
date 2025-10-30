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
      <Card>
        <CardHeader>
          <CardTitle>Exchange Connector Setup Guide</CardTitle>
          <CardDescription>
            Follow these steps to configure Exchange Online to route emails through our signature system (Rocketseed-style approach)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              <strong>Prerequisites:</strong> You need Exchange Online admin access and PowerShell with Exchange Online Management module installed.
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
                  Create a connector to route outbound emails through our edge function:
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
{`New-OutboundConnector -Name "SignatureConnector" \\
  -RecipientDomains * \\
  -SmartHosts "${connectorUrl}" \\
  -TlsSettings DomainValidation \\
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
                      `New-OutboundConnector -Name "SignatureConnector" -RecipientDomains * -SmartHosts "${connectorUrl}" -TlsSettings DomainValidation -UseMXRecord $false -CloudServicesMailEnabled $false -RouteAllMessagesViaOnPremises $false -Enabled $true`,
                      2
                    )}
                  >
                    {copiedStep === 2 ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Alert className="mt-3">
                  <AlertDescription className="text-xs">
                    <strong>Note:</strong> The connector URL is: <code className="bg-muted px-1 py-0.5 rounded">{connectorUrl}</code>
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
                  Create a rule to route all outbound emails through the connector:
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
{`New-TransportRule -Name "Route via Signature Connector" \\
  -FromScope InOrganization \\
  -SentToScope NotInOrganization \\
  -RouteMessageOutboundConnector "SignatureConnector" \\
  -Priority 0`}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(
                      `New-TransportRule -Name "Route via Signature Connector" -FromScope InOrganization -SentToScope NotInOrganization -RouteMessageOutboundConnector "SignatureConnector" -Priority 0`,
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
              <strong>How it works:</strong> When users send emails, Exchange routes them to our edge function, which adds signatures/banners based on user assignments, then forwards the complete email via SendGrid while preserving all recipients, attachments, and sender identity.
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
