import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Mail, Code, Server, Zap } from "lucide-react";

export const OutlookIntegrationGuide = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Outlook Email Routing Integration</h2>
        <p className="text-muted-foreground">
          Automatically add signatures and banners to outgoing emails from Outlook/Exchange
        </p>
      </div>

      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Emails sent from Outlook → Your system adds signature/banner → Sent to recipient
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Code className="h-5 w-5" />
          Integration Options
        </h3>

        <div className="space-y-6">
          {/* Option 1 */}
          <div>
            <h4 className="font-semibold text-base mb-2">Option 1: Outlook Add-in (Recommended for Production)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Create an Outlook add-in that intercepts emails before sending and adds signatures/banners.
            </p>
            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p><strong>Pros:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Real-time signature insertion before send</li>
                <li>Works with all Outlook clients (Desktop, Web, Mobile)</li>
                <li>Users see the signature before sending</li>
              </ul>
              <p className="mt-2"><strong>Cons:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Requires add-in development and deployment</li>
                <li>Users must install the add-in</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Option 2 */}
          <div>
            <h4 className="font-semibold text-base mb-2">Option 2: Microsoft Graph API Monitoring</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Monitor sent emails via Graph API and optionally resend with signatures/banners.
            </p>
            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p><strong>Pros:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>No user installation required</li>
                <li>Works automatically for all users</li>
              </ul>
              <p className="mt-2"><strong>Cons:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Post-send processing (email already sent)</li>
                <li>Would need to recall and resend (not ideal)</li>
              </ul>
            </div>
          </div>

          <Separator />

          {/* Option 3 */}
          <div>
            <h4 className="font-semibold text-base mb-2">Option 3: Exchange Transport Rules (Current Setup)</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Use Exchange transport rules to append signatures. Limited to static signatures per rule.
            </p>
            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p><strong>Pros:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Native Exchange functionality</li>
                <li>No additional software needed</li>
              </ul>
              <p className="mt-2"><strong>Cons:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Signatures are static per rule</li>
                <li>Cannot dynamically look up from database</li>
                <li>Requires manual PowerShell updates</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="h-5 w-5" />
          Your Current System (Email Routing Dashboard)
        </h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Your <strong>Email Routing</strong> dashboard is configured to test the transport rule setup. It demonstrates:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Looking up user assignments (signature + banner)</li>
            <li>Combining them into an email</li>
            <li>Sending via SendGrid API</li>
          </ul>
          <p className="mt-4">
            This is the <strong>backend logic</strong> that would power any of the integration options above.
          </p>
        </div>
      </Card>

      <Card className="p-6 bg-primary/5 border-primary/20">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Recommended Next Steps
        </h3>
        <ol className="list-decimal list-inside space-y-3 text-sm">
          <li>
            <strong>For immediate use:</strong> Continue using Exchange transport rules with manually updated signatures via PowerShell
          </li>
          <li>
            <strong>For automation:</strong> Develop an Outlook add-in that:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-muted-foreground">
              <li>Calls your <code>process-outbound-email</code> edge function</li>
              <li>Gets the user's signature/banner</li>
              <li>Inserts it before sending</li>
            </ul>
          </li>
          <li>
            <strong>Alternative:</strong> Use PowerShell automation to sync signatures from your database to Exchange transport rules daily
          </li>
        </ol>
      </Card>

      <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900">
        <AlertDescription className="text-sm">
          <strong>Important:</strong> Full automatic email interception requires either an Outlook add-in or a custom SMTP relay server. 
          Exchange transport rules alone cannot dynamically fetch signatures from your database per email.
        </AlertDescription>
      </Alert>
    </div>
  );
};
