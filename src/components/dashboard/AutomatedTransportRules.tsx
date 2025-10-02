import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, RefreshCw, Terminal, CheckCircle, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface UserAssignment {
  userId: string;
  userEmail: string;
  userName: string;
  signatureHtml: string;
  bannerHtml?: string;
}

interface AutomatedTransportRulesProps {
  profile: any;
}

export const AutomatedTransportRules = ({ profile }: AutomatedTransportRulesProps) => {
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [powershellScript, setPowershellScript] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.is_admin) {
      fetchAssignments();
    }
  }, [profile]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      // Get all active user assignments
      const { data: userAssignments, error } = await supabase
        .from("user_email_assignments")
        .select("id, user_id, signature_id")
        .eq("is_active", true);

      if (error) throw error;

      const assignmentsData: UserAssignment[] = [];

      for (const assignment of userAssignments || []) {
        // Get profile for this user
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("id", assignment.user_id)
          .single();

        if (!profile) continue;

        // Get signature
        const { data: signature } = await supabase
          .from("email_signatures")
          .select("html_content")
          .eq("id", assignment.signature_id)
          .single();

        if (!signature) continue;

        // Get banners for this assignment - take only the first one
        const { data: bannerAssignments } = await supabase
          .from("user_banner_assignments")
          .select(`
            banners (
              html_content,
              click_url
            )
          `)
          .eq("user_assignment_id", assignment.id)
          .order("display_order", { ascending: true })
          .limit(1);

        let bannerHtml = bannerAssignments?.[0]?.banners?.html_content || undefined;
        const clickUrl = bannerAssignments?.[0]?.banners?.click_url;

        // Wrap banner with clickable link if click_url exists
        if (bannerHtml && clickUrl) {
          bannerHtml = `<a href="${clickUrl}" target="_blank" style="display: block; text-decoration: none;">${bannerHtml}</a>`;
        }

        console.log(`User ${profile.email}: Has ${bannerAssignments?.length || 0} banner(s), using: ${bannerHtml ? 'Yes' : 'No'}, clickable: ${clickUrl ? 'Yes' : 'No'}`);

        assignmentsData.push({
          userId: assignment.user_id,
          userEmail: profile.email,
          userName: `${profile.first_name} ${profile.last_name}`.trim(),
          signatureHtml: signature.html_content,
          bannerHtml: bannerHtml || undefined,
        });
      }

      setAssignments(assignmentsData);
      
      // Auto-select all users by default
      setSelectedUserIds(new Set(assignmentsData.map(a => a.userId)));
      
      toast({
        title: "Assignments Loaded",
        description: `Found ${assignmentsData.length} active user assignment(s)`,
      });
    } catch (error: any) {
      console.error("Error fetching assignments:", error);
      toast({
        title: "Error Loading Assignments",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePowerShellScript = () => {
    setGenerating(true);
    try {
      const selectedAssignments = assignments.filter(a => selectedUserIds.has(a.userId));
      
      if (selectedAssignments.length === 0) {
        toast({
          title: "No Users Selected",
          description: "Please select at least one user to generate rules for",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      // Count total rules (each user gets 1 or 2 rules: banner + signature or just signature)
      let totalRules = 0;
      selectedAssignments.forEach(assignment => {
        if (assignment.bannerHtml) {
          totalRules += 2; // Banner rule + Signature rule
        } else {
          totalRules += 1; // Signature rule only
        }
      });

      let script = `# Exchange Online Transport Rules - Auto-generated
# Generated: ${new Date().toISOString()}
# Selected Users: ${selectedAssignments.length}
# Total Rules (with banner rotation): ${totalRules}

# Connect to Exchange Online
Connect-ExchangeOnline

Write-Host "=== STEP 1: Checking Existing Rules ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Current EmailSignature rules in Exchange:" -ForegroundColor Yellow
Get-TransportRule | Where-Object { $_.Name -like "EmailSignature_*" } | Format-Table Name, State, Priority, From -AutoSize
Write-Host ""

Write-Host "=== STEP 2: Removing Old Rules ===" -ForegroundColor Cyan
Write-Host ""

`;

      selectedAssignments.forEach((assignment, index) => {
        const baseRuleName = `EmailSignature_${assignment.userEmail.replace(/[^a-zA-Z0-9]/g, "_")}`;
        
        // Remove any existing rules for this user first (including old banner rules)
        script += `# User ${index + 1}: ${assignment.userName} (${assignment.userEmail})
Write-Host "Processing ${assignment.userEmail}..." -ForegroundColor White

# Remove ALL existing rules for this user
$existingRules = Get-TransportRule | Where-Object { $_.Name -like "${baseRuleName}*" }
if ($existingRules) {
    Write-Host "  Found $($existingRules.Count) existing rule(s) - removing..." -ForegroundColor Yellow
    $existingRules | ForEach-Object { 
        Write-Host "    Removing: $($_.Name)" -ForegroundColor Red
        Remove-TransportRule -Identity $_.Name -Confirm:$false 
    }
} else {
    Write-Host "  No existing rules found" -ForegroundColor Gray
}

`;
        
        // If user has no banner, create single rule with signature only
        if (!assignment.bannerHtml) {
          // Wrap signature with proper styling to match test email
          const wrappedSignature = `<div style="border-top: 1px solid #e9ecef; margin-top: 30px; padding-top: 20px;">${assignment.signatureHtml}</div>`;
          const escapedSignature = wrappedSignature.replace(/'/g, "''");
          
          script += `# Create signature rule (no banner)
New-TransportRule -Name "${baseRuleName}" \`
    -FromScope InOrganization \`
    -From "${assignment.userEmail}" \`
    -ApplyHtmlDisclaimerLocation Append \`
    -ApplyHtmlDisclaimerText '${escapedSignature}' \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true

Write-Host "  ✓ Signature rule created" -ForegroundColor Green
Write-Host ""

`;
        } else {
          // User has banner - create ONE banner rule and one signature rule
          // Wrap banner with proper styling to match test email
          const wrappedBanner = `<div style="margin-bottom: 20px;">${assignment.bannerHtml}</div>`;
          const escapedBanner = wrappedBanner.replace(/'/g, "''");
          
          // Wrap signature with proper styling to match test email
          const wrappedSignature = `<div style="border-top: 1px solid #e9ecef; margin-top: 30px; padding-top: 20px;">${assignment.signatureHtml}</div>`;
          const escapedSignature = wrappedSignature.replace(/'/g, "''");
          
          script += `# Creating 1 banner rule + 1 signature rule
`;

          // Create banner rule (prepend to top of email)
          const bannerRuleName = `${baseRuleName}_Banner`;
          
          script += `
# Banner rule (prepends at top)
New-TransportRule -Name "${bannerRuleName}" \`
    -FromScope InOrganization \`
    -From "${assignment.userEmail}" \`
    -ApplyHtmlDisclaimerLocation Prepend \`
    -ApplyHtmlDisclaimerText '${escapedBanner}' \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Priority ${index * 10}

Write-Host "  ✓ Banner rule created" -ForegroundColor Green
`;
          
          // Create signature rule (append to bottom)
          script += `
# Signature rule (appends at bottom)
New-TransportRule -Name "${baseRuleName}_Signature" \`
    -FromScope InOrganization \`
    -From "${assignment.userEmail}" \`
    -ApplyHtmlDisclaimerLocation Append \`
    -ApplyHtmlDisclaimerText '${escapedSignature}' \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Priority ${index * 10 + 100}

Write-Host "  ✓ Signature rule created" -ForegroundColor Green
Write-Host ""

`;
        }
      });

      script += `
Write-Host ""
Write-Host "=== STEP 3: Verifying Final Rules ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Current EmailSignature rules after update:" -ForegroundColor Yellow
Get-TransportRule | Where-Object { $_.Name -like "EmailSignature_*" } | Format-Table Name, State, Priority, From -AutoSize

Write-Host ""
Write-Host "=== COMPLETED ===" -ForegroundColor Green
Write-Host "Expected rules per user:" -ForegroundColor White
Write-Host "  • Users with banners: 2 rules (1 banner + 1 signature)" -ForegroundColor White
Write-Host "  • Users without banners: 1 rule (signature only)" -ForegroundColor White
Write-Host ""
Write-Host "If you still see old rules above, manually remove them with:" -ForegroundColor Yellow
Write-Host "  Remove-TransportRule -Identity '<RuleName>' -Confirm:\$false" -ForegroundColor Yellow
Write-Host ""
Write-Host "To disconnect: Disconnect-ExchangeOnline" -ForegroundColor Gray
`;

      setPowershellScript(script);
      
      toast({
        title: "PowerShell Script Generated",
        description: `Created script for ${selectedAssignments.length} user(s) with ${totalRules} rule(s)`,
      });
    } catch (error: any) {
      console.error("Error generating script:", error);
      toast({
        title: "Error Generating Script",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const downloadScript = () => {
    const blob = new Blob([powershellScript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exchange-transport-rules-${new Date().toISOString().split("T")[0]}.ps1`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Script Downloaded",
      description: "Run this script in Exchange Online PowerShell",
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(powershellScript);
    toast({
      title: "Copied to Clipboard",
      description: "PowerShell script copied successfully",
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === assignments.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(assignments.map(a => a.userId)));
    }
  };

  if (!profile?.is_admin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You need administrator privileges to access this feature.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automated Transport Rules</h2>
          <p className="text-muted-foreground">
            Generate PowerShell scripts to automatically update Exchange transport rules
          </p>
        </div>
        <Button onClick={fetchAssignments} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> This generates PowerShell scripts that create Exchange transport rules 
          for each user assignment. When users send emails, Exchange will automatically append their signature and banner.
        </AlertDescription>
      </Alert>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Current User Assignments</h3>
          {assignments.length > 0 && (
            <Button
              onClick={toggleSelectAll}
              variant="outline"
              size="sm"
            >
              {selectedUserIds.size === assignments.length ? "Deselect All" : "Select All"}
            </Button>
          )}
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading assignments...
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active user assignments found. Assign signatures to users first.
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {assignments.map((assignment) => {
                const hasBanner = !!assignment.bannerHtml;
                const isSelected = selectedUserIds.has(assignment.userId);
                
                return (
                  <div
                    key={assignment.userId}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-primary/5 border-primary' 
                        : 'bg-muted border-transparent hover:border-primary/50'
                    }`}
                    onClick={() => toggleUserSelection(assignment.userId)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUserSelection(assignment.userId)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{assignment.userName}</p>
                      <p className="text-sm text-muted-foreground">{assignment.userEmail}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge>Signature</Badge>
                      {hasBanner && (
                        <Badge variant="secondary">Banner</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>How it works:</strong> Banners appear at the <strong>top</strong> of emails with spacing, 
                signatures at the <strong>bottom</strong> with a separator line. Banner links remain clickable. 
                Rules apply to both internal and external recipients.
              </AlertDescription>
            </Alert>

            <Separator className="my-6" />

            <div className="flex gap-3">
              <Button
                onClick={generatePowerShellScript}
                disabled={generating || selectedUserIds.size === 0}
                className="flex-1"
              >
                <Terminal className="h-4 w-4 mr-2" />
                {generating ? "Generating..." : `Generate Script for ${selectedUserIds.size} User${selectedUserIds.size !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </>
        )}
      </Card>

      {powershellScript && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Generated PowerShell Script</h3>
            <div className="flex gap-2">
              <Button onClick={copyToClipboard} variant="outline" size="sm">
                Copy
              </Button>
              <Button onClick={downloadScript} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>

          <Alert className="mb-4">
            <Terminal className="h-4 w-4" />
            <AlertDescription>
              <strong>How to run:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Download or copy the script</li>
                <li>Open PowerShell as Administrator</li>
                <li>Run: <code className="bg-muted px-1 py-0.5 rounded">Connect-ExchangeOnline</code></li>
                <li>Run the downloaded script</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="bg-slate-950 text-green-400 p-4 rounded-lg overflow-x-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {powershellScript}
            </pre>
          </div>
        </Card>
      )}

      <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-900">
        <AlertDescription className="text-sm">
          <strong>Important:</strong> You need to regenerate and run this script whenever:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>A signature is updated</li>
            <li>A banner is updated</li>
            <li>User assignments change</li>
            <li>New users are added</li>
          </ul>
          <p className="mt-3">
            <strong>Formatting:</strong> Banners and signatures include proper HTML styling (spacing, borders) 
            to match the test email appearance. Banner links remain clickable. Rules apply to both internal and external recipients.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
};
