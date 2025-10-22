import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Server, Monitor, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeploymentMethodSelectorProps {
  selectedMethod: "transport-rules" | "client-side";
  onMethodChange: (method: "transport-rules" | "client-side") => void;
}

export const DeploymentMethodSelector = ({
  selectedMethod,
  onMethodChange,
}: DeploymentMethodSelectorProps) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Signature Deployment Method</CardTitle>
          <CardDescription>
            Choose how email signatures will be deployed to users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={selectedMethod}
            onValueChange={onMethodChange}
            className="space-y-4"
          >
            {/* Transport Rules Option */}
            <Card className={selectedMethod === "transport-rules" ? "border-primary" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="transport-rules" id="transport-rules" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="transport-rules" className="text-base font-semibold cursor-pointer">
                        <Server className="inline h-4 w-4 mr-2" />
                        Server-Side Transport Rules
                      </Label>
                      <Badge variant="outline">Recommended</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Signatures are automatically appended by Exchange Server when emails are sent
                    </p>
                    
                    <div className="space-y-2 mt-4">
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Centrally managed - no user intervention needed</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Works across all email clients (Outlook, mobile, webmail)</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Guarantees signature consistency</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Easy to update signatures globally</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Signature appears at the end of email (after reply history)</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Users cannot see signature in Outlook compose window</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Requires Exchange Admin PowerShell access</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Client-Side Option */}
            <Card className={selectedMethod === "client-side" ? "border-primary" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="client-side" id="client-side" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="client-side" className="text-base font-semibold cursor-pointer">
                        <Monitor className="inline h-4 w-4 mr-2" />
                        Client-Side Roaming Signatures
                      </Label>
                      <Badge variant="secondary">Office 365</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Signatures are stored in user's mailbox and appear in Outlook compose window
                    </p>
                    
                    <div className="space-y-2 mt-4">
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Signature appears above reply separator</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Visible to users in Outlook compose window</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Users can manually edit if needed</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Syncs across Outlook desktop, web, and mobile</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Requires Microsoft Graph API permissions</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Users can accidentally modify or delete signatures</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>May not work with non-Microsoft email clients</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </RadioGroup>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommendation:</strong> Use <strong>Transport Rules</strong> for complete control 
              and consistency. Use <strong>Client-Side</strong> if you need signatures to appear above 
              reply history and want users to see them while composing.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Comparison</CardTitle>
          <CardDescription>
            Technical differences between deployment methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-semibold">Feature</th>
                  <th className="text-left py-3 px-2 font-semibold">Transport Rules</th>
                  <th className="text-left py-3 px-2 font-semibold">Client-Side</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 px-2 font-medium">Signature Placement</td>
                  <td className="py-3 px-2">Bottom of email (after all content)</td>
                  <td className="py-3 px-2">Above reply separator</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Reply Behavior</td>
                  <td className="py-3 px-2">Appears after quoted text</td>
                  <td className="py-3 px-2">Appears before quoted text</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">User Visibility</td>
                  <td className="py-3 px-2">Not visible while composing</td>
                  <td className="py-3 px-2">Visible in compose window</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Management</td>
                  <td className="py-3 px-2">Admin-only via PowerShell</td>
                  <td className="py-3 px-2">Via Microsoft Graph API</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">User Control</td>
                  <td className="py-3 px-2">None - enforced by server</td>
                  <td className="py-3 px-2">Can edit/delete manually</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Email Client Support</td>
                  <td className="py-3 px-2">All clients (universal)</td>
                  <td className="py-3 px-2">Outlook only (desktop/web/mobile)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Deployment Speed</td>
                  <td className="py-3 px-2">Immediate (server-side)</td>
                  <td className="py-3 px-2">May take minutes to sync</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Consistency</td>
                  <td className="py-3 px-2">100% guaranteed</td>
                  <td className="py-3 px-2">Depends on user behavior</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Mobile App Support</td>
                  <td className="py-3 px-2">Yes (all mail apps)</td>
                  <td className="py-3 px-2">Outlook mobile only</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Webmail Support</td>
                  <td className="py-3 px-2">Yes (OWA, Gmail, any)</td>
                  <td className="py-3 px-2">Outlook Web only</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Banner Integration</td>
                  <td className="py-3 px-2">Full support</td>
                  <td className="py-3 px-2">Limited (part of signature)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Dynamic Content</td>
                  <td className="py-3 px-2">Server-based rules</td>
                  <td className="py-3 px-2">Static at deployment</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Setup Complexity</td>
                  <td className="py-3 px-2">Requires Exchange Admin</td>
                  <td className="py-3 px-2">Requires Graph API setup</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Best For</td>
                  <td className="py-3 px-2">Enterprise compliance & branding</td>
                  <td className="py-3 px-2">User-friendly experience</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Use Cases */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Use Cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Choose Transport Rules When:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
              <li>You need guaranteed signature consistency across the organization</li>
              <li>You want to enforce legal disclaimers that users cannot modify</li>
              <li>You have users on multiple email clients (Outlook, Gmail, mobile apps)</li>
              <li>You need to include marketing banners with tracking</li>
              <li>You want centralized management without user involvement</li>
              <li>Compliance requires signatures on all outbound emails</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Choose Client-Side When:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
              <li>Users need to see signatures while composing emails</li>
              <li>Signature should appear above reply history for better visibility</li>
              <li>Your organization exclusively uses Outlook (desktop, web, mobile)</li>
              <li>Users want the ability to temporarily edit signatures</li>
              <li>You prefer a more traditional email client experience</li>
              <li>You don't have Exchange Admin access but have Graph API permissions</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
