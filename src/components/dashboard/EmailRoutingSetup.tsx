import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, ExternalLink, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export const EmailRoutingSetup = () => {
  const { toast } = useToast();
  const [copiedStep, setCopiedStep] = useState<string | null>(null);
  
  const projectId = "ddoihmeqpjjiumqndjgk";
  const edgeFunctionUrl = `https://${projectId}.supabase.co/functions/v1/smtp-relay`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(label);
    setTimeout(() => setCopiedStep(null), 2000);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Important:</strong> This setup routes emails from Exchange through SendGrid to add signatures and banners.
          Complete all steps in order.
        </AlertDescription>
      </Alert>

      {/* Architecture Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Email Flow Architecture</CardTitle>
          <CardDescription>How emails are processed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Badge variant="outline">User (Outlook)</Badge>
            <span>→</span>
            <Badge variant="outline">Exchange</Badge>
            <span>→</span>
            <Badge variant="outline">SendGrid Parse</Badge>
            <span>→</span>
            <Badge variant="outline">Edge Function</Badge>
            <span>→</span>
            <Badge variant="outline">Adds Signature/Banner</Badge>
            <span>→</span>
            <Badge variant="outline">Resend</Badge>
            <span>→</span>
            <Badge variant="outline">Recipient</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: SendGrid IP Whitelisting */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              1
            </div>
            <CardTitle>Disable SendGrid IP Whitelisting</CardTitle>
          </div>
          <CardDescription>Required because Supabase uses dynamic IPs</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Go to SendGrid Dashboard → Settings → Access Management → IP Access Management</li>
            <li>Disable IP Access Management completely</li>
            <li>Click Save</li>
          </ol>
          <Button
            variant="outline"
            onClick={() => window.open("https://app.sendgrid.com/settings/access", "_blank")}
            className="w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open SendGrid Settings
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: SendGrid Inbound Parse */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              2
            </div>
            <CardTitle>Configure SendGrid Inbound Parse</CardTitle>
          </div>
          <CardDescription>Setup webhook to receive emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Go to SendGrid → Settings → Inbound Parse</li>
            <li>Click "Add Host & URL"</li>
            <li>Configure with these values:</li>
          </ol>
          
          <div className="space-y-3 pl-6">
            <div className="space-y-1">
              <label className="text-sm font-medium">Subdomain:</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">mail</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard("mail", "Subdomain")}
                >
                  {copiedStep === "Subdomain" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Domain:</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">cioafrica.co</code>
                <span className="text-sm text-muted-foreground self-center">(your domain)</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Destination URL:</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm break-all">{edgeFunctionUrl}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(edgeFunctionUrl, "Destination URL")}
                >
                  {copiedStep === "Destination URL" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Options:</label>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">Check "POST the raw, full MIME message"</span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => window.open("https://app.sendgrid.com/settings/parse", "_blank")}
            className="w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open SendGrid Inbound Parse
          </Button>
        </CardContent>
      </Card>

      {/* Step 3: DNS Records */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              3
            </div>
            <CardTitle>Add DNS MX Record</CardTitle>
          </div>
          <CardDescription>Configure your domain to receive emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Add this MX record to your domain's DNS settings:</p>
          
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Value</th>
                  <th className="px-4 py-2 text-left">Priority</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="px-4 py-2">
                    <Badge>MX</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-xs">mail.cioafrica.co</code>
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-xs">mx.sendgrid.net</code>
                  </td>
                  <td className="px-4 py-2">10</td>
                </tr>
              </tbody>
            </table>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              DNS changes can take up to 48 hours to propagate. Use{" "}
              <a href="https://mxtoolbox.com" target="_blank" rel="noopener noreferrer" className="underline">
                MXToolbox
              </a>{" "}
              to verify.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Step 4: Exchange Transport Rule */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              4
            </div>
            <CardTitle>Configure Exchange Transport Rule</CardTitle>
          </div>
          <CardDescription>Route outbound emails through the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Run this PowerShell command in Exchange Online PowerShell:</p>
          
          <div className="space-y-3">
            <div className="relative">
              <pre className="bg-muted p-4 rounded text-xs overflow-x-auto">
{`Connect-ExchangeOnline

New-TransportRule -Name "Email Signature System" \`
  -SentToScope NotInOrganization \`
  -BlindCopyTo "relay@mail.cioafrica.co" \`
  -Priority 0`}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(`Connect-ExchangeOnline\n\nNew-TransportRule -Name "Email Signature System" \`\n  -SentToScope NotInOrganization \`\n  -BlindCopyTo "relay@mail.cioafrica.co" \`\n  -Priority 0`, "PowerShell Script")}
              >
                {copiedStep === "PowerShell Script" ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                <strong>Important:</strong> Use relay@mail.cioafrica.co (or any email address at your mail.cioafrica.co subdomain).
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Testing</CardTitle>
          <CardDescription>Verify the setup works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Send a test email from Outlook to any external email address</li>
            <li>The email should arrive with your signature and banner added</li>
            <li>Check the edge function logs if emails aren't being processed</li>
          </ol>
          
          <Button
            variant="outline"
            onClick={() => window.open(`https://supabase.com/dashboard/project/${projectId}/functions/smtp-relay/logs`, "_blank")}
            className="w-full"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Edge Function Logs
          </Button>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>Emails not being processed:</strong>
              <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-muted-foreground">
                <li>Check SendGrid Activity Feed to verify emails reach Inbound Parse</li>
                <li>View edge function logs for errors</li>
                <li>Verify DNS MX record is configured correctly</li>
              </ul>
            </div>
            
            <div>
              <strong>Signatures not appearing:</strong>
              <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-muted-foreground">
                <li>Verify user email in profiles table matches sender</li>
                <li>Check user has active signature/banner assignment</li>
                <li>Review edge function logs for "No assignment found"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
