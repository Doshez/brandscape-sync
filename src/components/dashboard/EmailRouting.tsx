import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, RefreshCw, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface EmailRoutingProps {
  profile: any;
}

export const EmailRouting = ({ profile }: EmailRoutingProps) => {
  const [smtpSettings, setSmtpSettings] = useState({
    host: "",
    port: "587",
    username: "",
    password: "",
    secure: true,
  });
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSmtpSettings();
  }, []);

  const loadSmtpSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("brand_colors")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data?.brand_colors && typeof data.brand_colors === 'object') {
        const colors = data.brand_colors as any;
        if (colors.smtp_settings) {
          setSmtpSettings(colors.smtp_settings);
        }
      }
    } catch (error: any) {
      console.error("Error loading SMTP settings:", error);
    }
  };

  const saveSmtpSettings = async () => {
    setSaving(true);
    try {
      // First get existing brand_colors
      const { data: existingData } = await supabase
        .from("company_settings")
        .select("brand_colors, id")
        .limit(1)
        .maybeSingle();

      const existingColors = (existingData?.brand_colors as any) || {};
      const updatedColors = {
        ...existingColors,
        smtp_settings: smtpSettings,
      };

      if (existingData?.id) {
        const { error } = await supabase
          .from("company_settings")
          .update({
            brand_colors: updatedColors,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert({
            company_name: "Your Company",
            brand_colors: updatedColors,
          });

        if (error) throw error;
      }

      toast({
        title: "Settings Saved",
        description: "SMTP configuration has been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testEmailRouting = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please enter a test email address",
        variant: "destructive",
      });
      return;
    }

    if (!profile?.id) {
      toast({
        title: "Error",
        description: "User profile not found. Please refresh the page.",
        variant: "destructive",
      });
      console.error("Profile missing:", profile);
      return;
    }

    console.log("Sending test email with:", {
      recipientEmail: testEmail,
      senderUserId: profile.user_id,
      profile: profile
    });

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          recipientEmail: testEmail,
          senderUserId: profile.user_id,
        },
      });

      console.log("Edge function response:", { data, error });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Test Email Sent",
          description: `A test email with your signature and banner has been sent to ${testEmail}`,
        });
      } else {
        throw new Error(data?.error || "Failed to send test email");
      }
    } catch (error: any) {
      console.error("Test email error:", error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email. Check console for details.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Configuration copied to clipboard",
    });
  };

  return (
    <div className="space-y-6">
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How It Works:</strong> When you configure email routing, all outbound emails are processed by our service. 
          We automatically attach the assigned signature and banners to each email based on the sender's email address. 
          This ensures 100% signature and banner consistency without any user intervention.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Configuration
          </CardTitle>
          <CardDescription>
            Configure your email server settings for routing signatures and banners
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <div className="flex gap-2">
                <Input
                  id="smtp-host"
                  placeholder="smtp.office365.com"
                  value={smtpSettings.host}
                  onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(smtpSettings.host)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="smtp-port">SMTP Port</Label>
              <Input
                id="smtp-port"
                placeholder="587"
                value={smtpSettings.port}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="smtp-username">Username / Email</Label>
              <Input
                id="smtp-username"
                type="email"
                placeholder="admin@yourdomain.com"
                value={smtpSettings.username}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, username: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="smtp-password">Password / API Key</Label>
              <Input
                id="smtp-password"
                type="password"
                placeholder="Your SMTP password or SendGrid API key"
                value={smtpSettings.password}
                onChange={(e) => setSmtpSettings({ ...smtpSettings, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                For SendGrid, use your API key (starts with SG.)
              </p>
            </div>

            <Button onClick={saveSmtpSettings} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Save SMTP Settings
                </>
              )}
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>Test Email Routing</Label>
            <p className="text-xs text-muted-foreground">
              Send a test email to verify your signature and banner are attached correctly. 
              This will use your assigned signature and banner from the dashboard.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <Button onClick={testEmailRouting} disabled={testing} variant="outline">
                {testing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  "Send Test"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p><strong>Important:</strong> SMTP credentials are securely stored and used only for email routing.</p>
            <p>
              <strong>Test Email:</strong> The test feature uses your assigned signature and banner from the dashboard. 
              Make sure you have a signature and banner assigned in the "User Assignments" section before testing.
            </p>
            <p className="text-xs">
              For Exchange Online, you can alternatively use the "Deploy to Exchange" section with Transport Rules.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong className="text-foreground">Microsoft 365 / Office 365:</strong>
              <ul className="mt-1 space-y-1 text-muted-foreground ml-4 list-disc">
                <li>SMTP Host: smtp.office365.com</li>
                <li>Port: 587 (TLS)</li>
                <li>Username: Your full email address</li>
              </ul>
            </div>
            <Separator />
            <div>
              <strong className="text-foreground">Gmail:</strong>
              <ul className="mt-1 space-y-1 text-muted-foreground ml-4 list-disc">
                <li>SMTP Host: smtp.gmail.com</li>
                <li>Port: 587 (TLS)</li>
                <li>Username: Your Gmail address</li>
                <li>Note: Use App Password if 2FA is enabled</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
