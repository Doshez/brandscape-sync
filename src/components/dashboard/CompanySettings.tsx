import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, Save, Upload } from "lucide-react";

interface CompanySettingsProps {
  profile: any;
}

interface CompanySettings {
  id?: string;
  company_name: string;
  company_website: string;
  company_address: string;
  company_phone: string;
  legal_disclaimer: string;
  default_signature_template: string;
  logo_url: string;
  brand_colors: any;
}

export const CompanySettings = ({ profile }: CompanySettingsProps) => {
  const [settings, setSettings] = useState<CompanySettings>({
    company_name: "",
    company_website: "",
    company_address: "",
    company_phone: "",
    legal_disclaimer: "",
    default_signature_template: "",
    logo_url: "",
    brand_colors: { primary: "#000000", secondary: "#666666" },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.is_admin) {
      fetchCompanySettings();
    }
  }, [profile]);

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
          company_name: data.company_name || "",
          company_website: data.company_website || "",
          company_address: data.company_address || "",
          company_phone: data.company_phone || "",
          legal_disclaimer: data.legal_disclaimer || "",
          default_signature_template: data.default_signature_template || "",
          logo_url: data.logo_url || "",
          brand_colors: data.brand_colors || { primary: "#000000", secondary: "#666666" },
        });
      }
    } catch (error) {
      console.error("Error fetching company settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const settingsData = {
        ...settings,
        created_by: profile?.user_id,
      };

      let result;
      if (settings.id) {
        // Update existing settings
        result = await supabase
          .from("company_settings")
          .update(settingsData)
          .eq("id", settings.id);
      } else {
        // Create new settings
        result = await supabase
          .from("company_settings")
          .insert([settingsData]);
      }

      if (result.error) throw result.error;

      toast({
        title: "Success",
        description: "Company settings saved successfully",
      });

      // Refresh settings to get the ID if it was a new record
      if (!settings.id) {
        fetchCompanySettings();
      }
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

  const defaultSignatureTemplate = `<table cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4;">
  <tr>
    <td style="padding-right: 20px; vertical-align: top;">
      {{#LOGO_URL}}
      <img src="{{LOGO_URL}}" alt="" style="max-width: 120px; height: auto;" />
      {{/LOGO_URL}}
    </td>
    <td style="border-left: 3px solid {{PRIMARY_COLOR}}; padding-left: 20px; vertical-align: top;">
      <p style="margin: 0; font-weight: bold; color: {{PRIMARY_COLOR}};">{{FIRST_NAME}} {{LAST_NAME}}</p>
      <p style="margin: 0; color: {{SECONDARY_COLOR}};">{{JOB_TITLE}}</p>
      <p style="margin: 0; font-weight: bold;">{{COMPANY_NAME}}</p>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: {{SECONDARY_COLOR}};">
        📞 {{PHONE}} | 📱 {{MOBILE}}<br>
        ✉️ {{EMAIL}} | 🌐 {{COMPANY_WEBSITE}}
      </p>
      {{#LEGAL_DISCLAIMER}}
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 8px;">
        {{LEGAL_DISCLAIMER}}
      </p>
      {{/LEGAL_DISCLAIMER}}
    </td>
  </tr>
</table>`;

  if (!profile?.is_admin) {
    return (
      <div className="text-center py-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-muted-foreground">Only administrators can manage company settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Company Settings</h3>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-20 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Company Settings</h3>
          <p className="text-muted-foreground">
            Configure global settings for email signatures
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Company Information</span>
            </CardTitle>
            <CardDescription>
              Basic company details for email signatures
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  placeholder="Your Company Inc."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_website">Website</Label>
                <Input
                  id="company_website"
                  type="url"
                  value={settings.company_website}
                  onChange={(e) => setSettings({ ...settings, company_website: e.target.value })}
                  placeholder="https://company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_phone">Main Phone Number</Label>
                <Input
                  id="company_phone"
                  value={settings.company_phone}
                  onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <div className="flex space-x-2">
                  <Input
                    id="logo_url"
                    type="url"
                    value={settings.logo_url}
                    onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                    placeholder="https://company.com/logo.png"
                  />
                  <Button type="button" variant="outline" size="sm">
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_address">Address</Label>
              <Textarea
                id="company_address"
                value={settings.company_address}
                onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                placeholder="123 Business St, Suite 100, City, State 12345"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Colors</CardTitle>
            <CardDescription>
              Colors used in email signature templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex space-x-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={settings.brand_colors.primary}
                    onChange={(e) => setSettings({
                      ...settings,
                      brand_colors: { ...settings.brand_colors, primary: e.target.value }
                    })}
                    className="w-16"
                  />
                  <Input
                    value={settings.brand_colors.primary}
                    onChange={(e) => setSettings({
                      ...settings,
                      brand_colors: { ...settings.brand_colors, primary: e.target.value }
                    })}
                    placeholder="#000000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex space-x-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={settings.brand_colors.secondary}
                    onChange={(e) => setSettings({
                      ...settings,
                      brand_colors: { ...settings.brand_colors, secondary: e.target.value }
                    })}
                    className="w-16"
                  />
                  <Input
                    value={settings.brand_colors.secondary}
                    onChange={(e) => setSettings({
                      ...settings,
                      brand_colors: { ...settings.brand_colors, secondary: e.target.value }
                    })}
                    placeholder="#666666"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Legal & Compliance</CardTitle>
            <CardDescription>
              Legal disclaimer and compliance text
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="legal_disclaimer">Legal Disclaimer</Label>
              <Textarea
                id="legal_disclaimer"
                value={settings.legal_disclaimer}
                onChange={(e) => setSettings({ ...settings, legal_disclaimer: e.target.value })}
                placeholder="This email and any attachments are confidential..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Signature Template</CardTitle>
            <CardDescription>
              HTML template used as the default for new signatures
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default_signature_template">HTML Template</Label>
                <Textarea
                  id="default_signature_template"
                  value={settings.default_signature_template || defaultSignatureTemplate}
                  onChange={(e) => setSettings({ ...settings, default_signature_template: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {`{{FIRST_NAME}}, {{LAST_NAME}}, {{EMAIL}}, {{PHONE}}, {{MOBILE}}, {{JOB_TITLE}}, {{DEPARTMENT}}, {{COMPANY_NAME}}, {{COMPANY_WEBSITE}}, {{LOGO_URL}}, {{PRIMARY_COLOR}}, {{SECONDARY_COLOR}}, {{LEGAL_DISCLAIMER}}`}
                </p>
              </div>

              {!settings.default_signature_template && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettings({ ...settings, default_signature_template: defaultSignatureTemplate })}
                >
                  Use Default Template
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
};