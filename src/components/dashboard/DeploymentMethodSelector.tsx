import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Server, Mail, CheckCircle2, XCircle, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeploymentMethodSelectorProps {
  selectedMethod: "transport-rules" | "email-routing" | "exchange-connector";
  onMethodChange: (method: "transport-rules" | "email-routing" | "exchange-connector") => void;
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

            {/* Email Routing Option */}
            <Card className={selectedMethod === "email-routing" ? "border-primary" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="email-routing" id="email-routing" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="email-routing" className="text-base font-semibold cursor-pointer">
                        <Mail className="inline h-4 w-4 mr-2" />
                        Email Routing (SMTP Relay)
                      </Label>
                      <Badge variant="secondary">Legacy</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Route emails through our service to automatically attach signatures and banners before delivery
                    </p>
                    
                    <div className="space-y-2 mt-4">
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Works with any email client and provider</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>CC/BCC may not work correctly</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Multiple recipients may cause issues</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>Attachments may not work properly</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exchange Connector Option */}
            <Card className={selectedMethod === "exchange-connector" ? "border-primary" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="exchange-connector" id="exchange-connector" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="exchange-connector" className="text-base font-semibold cursor-pointer">
                        <Link2 className="inline h-4 w-4 mr-2" />
                        Exchange Connector (Rocketseed Style)
                      </Label>
                      <Badge>Best Solution</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Exchange routes emails to our service → we add signatures/banners → forward via SendGrid with perfect preservation
                    </p>
                    
                    <div className="space-y-2 mt-4">
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Perfect CC/BCC handling - all recipients preserved</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Multiple recipients work flawlessly</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Original sender address preserved</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Attachments remain intact</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Full banner tracking and analytics</span>
                      </div>
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>Works with all Outlook versions and mobile</span>
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
              <strong>Recommendation:</strong> Use <strong>Transport Rules</strong> for Exchange/Microsoft 365 
              environments with admin access. Use <strong>Email Routing</strong> if you need guaranteed 
              signature/banner attachment without Exchange admin permissions or want to work with any email provider.
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
                  <th className="text-left py-3 px-2 font-semibold">Email Routing</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 px-2 font-medium">Signature Placement</td>
                  <td className="py-3 px-2">Bottom of email (after all content)</td>
                  <td className="py-3 px-2">After banners, before message body</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Banner Placement</td>
                  <td className="py-3 px-2">Configurable via rules</td>
                  <td className="py-3 px-2">Top of email (before message body)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Reply Behavior</td>
                  <td className="py-3 px-2">Appears after quoted text</td>
                  <td className="py-3 px-2">Intelligently placed based on content</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">User Visibility</td>
                  <td className="py-3 px-2">Not visible while composing</td>
                  <td className="py-3 px-2">Not visible while composing</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Management</td>
                  <td className="py-3 px-2">Admin-only via PowerShell</td>
                  <td className="py-3 px-2">Via web dashboard</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">User Control</td>
                  <td className="py-3 px-2">None - enforced by server</td>
                  <td className="py-3 px-2">None - enforced by routing service</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Email Client Support</td>
                  <td className="py-3 px-2">All clients (universal)</td>
                  <td className="py-3 px-2">All clients (universal)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Email Provider Support</td>
                  <td className="py-3 px-2">Microsoft 365 / Exchange only</td>
                  <td className="py-3 px-2">Any provider (Gmail, Outlook, etc.)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Deployment Speed</td>
                  <td className="py-3 px-2">Immediate (server-side)</td>
                  <td className="py-3 px-2">Immediate (routing layer)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Consistency</td>
                  <td className="py-3 px-2">100% guaranteed</td>
                  <td className="py-3 px-2">100% guaranteed</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Tracking & Analytics</td>
                  <td className="py-3 px-2">Limited</td>
                  <td className="py-3 px-2">Full banner view/click tracking</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">DNS Configuration</td>
                  <td className="py-3 px-2">Not required</td>
                  <td className="py-3 px-2">Required (MX or connector records)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Admin Permissions</td>
                  <td className="py-3 px-2">Exchange Admin required</td>
                  <td className="py-3 px-2">DNS access only</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Setup Complexity</td>
                  <td className="py-3 px-2">Medium (PowerShell scripts)</td>
                  <td className="py-3 px-2">Medium (DNS + SMTP configuration)</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Best For</td>
                  <td className="py-3 px-2">Microsoft 365 enterprises</td>
                  <td className="py-3 px-2">Multi-provider or advanced tracking needs</td>
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
              <Mail className="h-4 w-4" />
              Choose Email Routing When:
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-6">
              <li>You need 100% guaranteed signature and banner attachment</li>
              <li>You don't have Exchange Admin PowerShell access</li>
              <li>You use multiple email providers (Gmail, Outlook, custom domains)</li>
              <li>You want advanced banner tracking and analytics</li>
              <li>You need dynamic content insertion per user</li>
              <li>You want to avoid PowerShell scripts and manual rule management</li>
              <li>Your organization values flexibility and provider independence</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
