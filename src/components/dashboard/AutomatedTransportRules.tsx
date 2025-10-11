import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, RefreshCw, Terminal, CheckCircle, AlertCircle, Plus, Trash2, Mail, Image, FileText, Shield, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmailRoutingPanel } from "./EmailRoutingPanel";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UserAssignment {
  userId: string;
  userEmail: string;
  userName: string;
  signatureHtml: string;
  bannerHtml?: string;
  bannerId?: string;
  bannerClickUrl?: string;
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
  const [scriptType, setScriptType] = useState<"both" | "signature" | "banner">("both");
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);
  
  // User assignment states
  const [users, setUsers] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedSignature, setSelectedSignature] = useState("");
  const [selectedBanner, setSelectedBanner] = useState("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Domain-wide assignment states
  const [domainWideMode, setDomainWideMode] = useState(false);
  const [domainName, setDomainName] = useState("cioaafrica.co");
  const [domainWideBanner, setDomainWideBanner] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.is_admin) {
      fetchAllData();
    }
  }, [profile]);

  const fetchAllData = async () => {
    await Promise.all([
      fetchAssignments(),
      fetchUsers(),
      fetchSignatures(),
      fetchBanners()
    ]);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("first_name");

      if (error) throw error;
      
      const uniqueUsers = (data || []).filter((user, index, self) => 
        user.email && 
        index === self.findIndex(u => u.email === user.email)
      );
      
      setUsers(uniqueUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchSignatures = async () => {
    try {
      const { data, error } = await supabase
        .from("email_signatures")
        .select("*")
        .eq("is_active", true)
        .order("template_name");

      if (error) throw error;
      setSignatures(data || []);
    } catch (error: any) {
      console.error("Error fetching signatures:", error);
    }
  };

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      console.error("Error fetching banners:", error);
    }
  };

  const handleCreateAssignment = async () => {
    if (!selectedUser || !selectedSignature) {
      toast({
        title: "Missing Information",
        description: "Please select both a user and signature",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedUserProfile = users.find(user => user.id === selectedUser);
      if (!selectedUserProfile) {
        toast({
          title: "Error",
          description: "Selected user not found",
          variant: "destructive",
        });
        return;
      }

      const userIdForAssignment = selectedUserProfile.user_id || selectedUserProfile.id;

      // Deactivate existing assignments
      await supabase
        .from("user_email_assignments")
        .update({ is_active: false })
        .eq("user_id", userIdForAssignment);

      // Create new assignment
      const { data: assignment, error: assignmentError } = await supabase
        .from("user_email_assignments")
        .insert({
          user_id: userIdForAssignment,
          signature_id: selectedSignature,
          is_active: true
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;

      // Add banner if selected
      if (selectedBanner && selectedBanner !== "none") {
        const { error: bannerError } = await supabase
          .from("user_banner_assignments")
          .insert({
            user_assignment_id: assignment.id,
            banner_id: selectedBanner,
            display_order: 1
          });

        if (bannerError) throw bannerError;
      }

      toast({
        title: "Success",
        description: "User assignment created successfully",
      });

      setSelectedUser("");
      setSelectedSignature("");
      setSelectedBanner("");
      fetchAllData();
    } catch (error: any) {
      console.error("Error creating assignment:", error);
      toast({
        title: "Error",
        description: "Failed to create user assignment",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("user_email_assignments")
        .update({ is_active: false })
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User assignment removed successfully",
      });

      fetchAllData();
    } catch (error: any) {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "Failed to remove user assignment",
        variant: "destructive",
      });
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      console.log("🔍 Fetching user email assignments from user_email_assignments table...");
      
      // Get all active user assignments
      const { data: userAssignments, error } = await supabase
        .from("user_email_assignments")
        .select("id, user_id, signature_id")
        .eq("is_active", true);

      if (error) throw error;

      console.log(`✓ Found ${userAssignments?.length || 0} active user assignments`);

      const assignmentsData: UserAssignment[] = [];
      const seenUserIds = new Set<string>(); // Track to prevent duplicates

      for (const assignment of userAssignments || []) {
        console.log(`\n📧 Processing assignment ID: ${assignment.id}`);
        
        // Skip if we've already processed this user (prevent duplicates)
        if (seenUserIds.has(assignment.user_id)) {
          console.log(`  ⏭️ Skipping duplicate assignment for user_id: ${assignment.user_id}`);
          continue;
        }
        
        // Get profile for this user
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("id", assignment.user_id)
          .single();

        if (!profile) {
          console.log(`  ⚠️ No profile found for user_id: ${assignment.user_id}`);
          continue;
        }
        
        seenUserIds.add(assignment.user_id); // Mark as processed
        console.log(`  ✓ Profile: ${profile.email}`);

        // Get signature
        console.log(`  🔍 Fetching signature ID: ${assignment.signature_id} from email_signatures table`);
        const { data: signature } = await supabase
          .from("email_signatures")
          .select("html_content, template_name")
          .eq("id", assignment.signature_id)
          .single();

        if (!signature) {
          console.log(`  ⚠️ No signature found for ID ${assignment.signature_id}`);
          continue;
        }

        console.log(`  ✓ Signature: "${signature.template_name}" (${signature.html_content?.length || 0} chars)`);

        // Skip if signature HTML is empty
        if (!signature.html_content || signature.html_content.trim() === '') {
          console.log(`  ⚠️ Signature HTML is empty, skipping this assignment`);
          continue;
        }

        // Get banners for this assignment - take only the first one
        console.log(`  🔍 Fetching banners from user_banner_assignments table for assignment ID: ${assignment.id}`);
        const { data: bannerAssignments } = await supabase
          .from("user_banner_assignments")
          .select(`
            banner_id,
            banners (
              id,
              html_content,
              click_url,
              name
            )
          `)
          .eq("user_assignment_id", assignment.id)
          .order("display_order", { ascending: true })
          .limit(1);

        const bannerData = bannerAssignments?.[0]?.banners;
        const bannerHtml = bannerData?.html_content;
        const bannerId = bannerData?.id;
        const clickUrl = bannerData?.click_url;
        const bannerName = bannerData?.name;

        if (bannerHtml) {
          if (clickUrl) {
            console.log(`  ✓ Banner: "${bannerName}" with click URL: ${clickUrl}`);
          } else {
            console.log(`  ✓ Banner: "${bannerName}" (no click URL)`);
          }
        } else {
          console.log(`  ℹ️ No banner assigned`);
        }

        console.log(`  ✅ Added to assignments list\n`);

        assignmentsData.push({
          userId: assignment.user_id,
          userEmail: profile.email,
          userName: `${profile.first_name} ${profile.last_name}`.trim(),
          signatureHtml: signature.html_content,
          bannerHtml: bannerHtml || undefined,
          bannerId: bannerId,
          bannerClickUrl: clickUrl,
        });
      }

      console.log(`\n🎉 Successfully loaded ${assignmentsData.length} complete assignment(s)\n`);

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

  const generateCleanupScript = () => {
    const script = `# ULTRA-AGGRESSIVE CLEANUP SCRIPT - Remove ALL Disclaimer/Signature/Banner Rules
# Generated: ${new Date().toISOString()}

# Connect to Exchange Online
Connect-ExchangeOnline

Write-Host "=== SCANNING ALL TRANSPORT RULES ===" -ForegroundColor Cyan
Write-Host ""

# Get ALL rules that apply HTML disclaimers (signatures/banners)
Write-Host "Finding ALL rules that modify email content (signatures/banners)..." -ForegroundColor Yellow
$allDisclaimerRules = Get-TransportRule | Where-Object { 
    $_.ApplyHtmlDisclaimerText -ne $null -or 
    $_.Name -like "*EmailSignature*" -or 
    $_.Name -like "*Banner*" -or 
    $_.Name -like "*Signature*" -or
    $_.Name -like "*Disclaimer*"
}

if ($allDisclaimerRules) {
    Write-Host ""
    Write-Host "Found $($allDisclaimerRules.Count) rule(s) that modify email content:" -ForegroundColor Red
    Write-Host ""
    $allDisclaimerRules | Format-Table Name, State, Priority, From, @{Label="Location";Expression={if($_.ApplyHtmlDisclaimerLocation){"Append/Prepend"}else{"N/A"}}} -AutoSize
    Write-Host ""
    Write-Host "These rules will be PERMANENTLY DELETED:" -ForegroundColor Red
    $allDisclaimerRules | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Yellow }
    Write-Host ""
    
    $confirm = Read-Host "⚠️  Remove ALL $($allDisclaimerRules.Count) rules? (type YES to proceed)"
    if ($confirm -eq "YES") {
        Write-Host ""
        Write-Host "Removing all rules..." -ForegroundColor Red
        $allDisclaimerRules | ForEach-Object { 
            Write-Host "  Deleting: $($_.Name)" -ForegroundColor Red
            Remove-TransportRule -Identity $_.Name -Confirm:$false -ErrorAction SilentlyContinue
        }
        Write-Host ""
        Write-Host "Waiting 10 seconds for Exchange to sync..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        Write-Host ""
        
        # Verify cleanup
        $remaining = Get-TransportRule | Where-Object { 
            $_.ApplyHtmlDisclaimerText -ne $null -or 
            $_.Name -like "*EmailSignature*" -or 
            $_.Name -like "*Banner*" -or 
            $_.Name -like "*Signature*"
        }
        
        if ($remaining) {
            Write-Host "⚠️  WARNING: $($remaining.Count) rule(s) still exist!" -ForegroundColor Red
            $remaining | Format-Table Name, State -AutoSize
        } else {
            Write-Host "✓ All rules successfully removed!" -ForegroundColor Green
            Write-Host "✓ Email system is now clean - ready for new deployment" -ForegroundColor Green
        }
    } else {
        Write-Host "Cancelled - No changes made" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ No disclaimer/signature/banner rules found" -ForegroundColor Green
    Write-Host "Email system is already clean" -ForegroundColor Green
}

Write-Host ""
Disconnect-ExchangeOnline -Confirm:$false
`;
    
    setPowershellScript(script);
    toast({
      title: "Cleanup Script Generated",
      description: "Run this first to remove ALL existing rules",
    });
  };

  const generateDomainWideScript = () => {
    setGenerating(true);
    try {
      if (!domainName || !domainWideBanner) {
        toast({
          title: "Missing Information",
          description: "Please enter domain name and select a banner",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const banner = banners.find(b => b.id === domainWideBanner);
      if (!banner) {
        toast({
          title: "Banner Not Found",
          description: "Selected banner could not be found",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const uniqueTimestamp = Date.now().toString().slice(-8);
      const dateStamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const groupId = `${dateStamp}_${uniqueTimestamp}_DomainWide`;
      
      let finalBannerHtml = banner.html_content;
      const bannerId = banner.id;
      const uniqueMarker = `banner-id-${bannerId}`;
      
      // Add tracking URL if click_url exists
      if (banner.click_url && bannerId) {
        const trackingUrl = `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/track-banner-click?banner_id=${bannerId}&email=domain-wide`;
        
        if (finalBannerHtml.includes('<a ') || finalBannerHtml.includes('<a>')) {
          finalBannerHtml = finalBannerHtml.replace(/href="[^"]*"/gi, `href="${trackingUrl}"`);
          finalBannerHtml = finalBannerHtml.replace(/href='[^']*'/gi, `href="${trackingUrl}"`);
          if (!finalBannerHtml.includes('target=')) {
            finalBannerHtml = finalBannerHtml.replace(/<a /gi, '<a target="_blank" ');
          }
        } else {
          finalBannerHtml = `<a href="${trackingUrl}" target="_blank" style="display: block; text-decoration: none;">${banner.html_content}</a>`;
        }
      }
      
      // Use a hidden span with unique text that Exchange can detect (not HTML comment)
      const uniqueText = `BANNER_MARKER_${uniqueMarker.replace('banner-id-', '')}`;
      const wrappedBanner = `<div style="margin-bottom: 20px;"><span style="display:none;font-size:0;height:0;width:0;line-height:0;overflow:hidden;">${uniqueText}</span>${finalBannerHtml}</div>`;
      const escapedBanner = wrappedBanner.replace(/'/g, "''");
      
      const script = `# Exchange Online Domain-Wide Banner Rule
# Generated: ${new Date().toISOString()}
# Domain: ${domainName}
# Banner: ${banner.name}
# Applies to: ALL users in domain

# Connect to Exchange Online
Connect-ExchangeOnline

Write-Host "=== Creating Domain-Wide Banner Rule ===" -ForegroundColor Cyan
Write-Host "Existing rules will be preserved" -ForegroundColor Yellow
Write-Host ""

# Create domain-wide banner rule  
# Applies to ALL users sending from @${domainName}
# Exception check: Hidden text marker (${uniqueText}) prevents duplicates
New-TransportRule -Name "BANNER_${groupId}_DomainWide_${domainName}" \`
    -FromScope InOrganization \`
    -SenderAddressLocation HeaderOrEnvelope \`
    -SenderDomainIs "${domainName}" \`
    -ApplyHtmlDisclaimerLocation Prepend \`
    -ApplyHtmlDisclaimerText '${escapedBanner}' \`
    -ExceptIfSubjectOrBodyContainsWords "${uniqueText}" \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Priority 0 \`
    -Comments "Domain-wide banner for all users @${domainName}"

Write-Host "✓ Domain-wide banner rule created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Rule Details:" -ForegroundColor Cyan
Write-Host "  - Applies to: ALL users @${domainName}" -ForegroundColor White
Write-Host "  - Banner: ${banner.name}" -ForegroundColor White
Write-Host "  - Location: Above email body (Prepend)" -ForegroundColor White
Write-Host "  - Duplication prevention: ${uniqueText}" -ForegroundColor White
Write-Host ""

Write-Host "=== Verifying Rule ===" -ForegroundColor Cyan
Write-Host ""
Get-TransportRule -Identity "BANNER_${groupId}_DomainWide_${domainName}" | Format-List Name, State, Priority, SenderDomainIs, ApplyHtmlDisclaimerLocation

Write-Host ""
Write-Host "=== COMPLETED ===" -ForegroundColor Green
Write-Host "Domain-wide banner is now active for @${domainName}" -ForegroundColor White
Write-Host ""
Write-Host "To disconnect: Disconnect-ExchangeOnline" -ForegroundColor Gray
`;

      setPowershellScript(script);
      
      toast({
        title: "Domain-Wide Script Generated",
        description: `Banner will apply to all users @${domainName}`,
      });
    } catch (error: any) {
      console.error("Error generating domain-wide script:", error);
      toast({
        title: "Error Generating Script",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const generatePowerShellScript = () => {
    // Use domain-wide script generator if that mode is enabled
    if (domainWideMode) {
      generateDomainWideScript();
      return;
    }
    
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

      // Generate unique timestamp for this batch of rules
      const uniqueTimestamp = Date.now().toString().slice(-8);
      const dateStamp = new Date().toISOString().split('T')[0].replace(/-/g, '');

      // Create individual rules per user to enable email tracking
      const groupedRules = new Map<string, {
        signatureHtml: string;
        bannerHtml?: string;
        bannerId?: string;
        bannerClickUrl?: string;
        users: Array<{ email: string; name: string }>;
      }>();

      selectedAssignments.forEach(assignment => {
        // Create unique key per user to enable email tracking in banner clicks
        const key = `${assignment.userEmail}_${assignment.signatureHtml}_${assignment.bannerHtml || 'NONE'}_${assignment.bannerId || 'NONE'}`;
        
        if (!groupedRules.has(key)) {
          groupedRules.set(key, {
            signatureHtml: assignment.signatureHtml,
            bannerHtml: assignment.bannerHtml,
            bannerId: assignment.bannerId,
            bannerClickUrl: assignment.bannerClickUrl,
            users: []
          });
        }
        
        groupedRules.get(key)!.users.push({
          email: assignment.userEmail,
          name: assignment.userName
        });
      });

      // Count total rules - separate banner (Prepend) and signature (Append) rules
      let totalRules = 0;
      groupedRules.forEach(group => {
        if (scriptType === "both") {
          if (group.bannerHtml) {
            totalRules += 2; // Banner (Prepend above body) + Signature (Append below body)
          } else {
            totalRules += 1; // Signature only (Append below body)
          }
        } else if (scriptType === "signature") {
          totalRules += 1; // Signature rule only
        } else if (scriptType === "banner" && group.bannerHtml) {
          totalRules += 1; // Banner rule only
        }
      });

      const scriptTypeLabel = scriptType === "both" ? "Signature + Banner" : scriptType === "signature" ? "Signature Only" : "Banner Only";
      
      let script = `# Exchange Online Transport Rules - Auto-generated (${scriptTypeLabel})
# Generated: ${new Date().toISOString()}
# Selected Users: ${selectedAssignments.length}
# Unique Rule Groups: ${groupedRules.size}
# Total Rules: ${totalRules}
#
# IMPORTANT: This script will NOT delete existing rules
# New rules will be created alongside your existing transport rules
# To remove old rules, use the Cleanup tab or manually delete them via Exchange Admin Center
#
# SIGNATURE BEHAVIOR IN EMAIL REPLIES:
# - Signatures are added to each NEW outbound message you send
# - In reply threads, the signature appears after YOUR NEW MESSAGE CONTENT
# - Previous messages in the thread will NOT have signatures added to them
# - If you want signatures to appear immediately after your reply text:
#   1. Configure your email client to "reply inline" or "reply above" mode
#   2. This ensures your new message (with signature) appears at the top
#   3. The transport rule will append the signature right after your text

# Connect to Exchange Online
Connect-ExchangeOnline

Write-Host "=== Creating New Rules ===" -ForegroundColor Cyan
Write-Host "Existing rules will be preserved" -ForegroundColor Yellow
Write-Host ""

`;

      let ruleIndex = 0;
      groupedRules.forEach((group, key) => {
        // Skip if no users in this group for banner-only mode
        if (scriptType === "banner" && !group.bannerHtml) {
          return;
        }

        ruleIndex++;
        const groupId = `${dateStamp}_${uniqueTimestamp}_G${ruleIndex}`;
        const userEmails = group.users.map(u => u.email).join('", "');
        const userCount = group.users.length;
        
        script += `# ========================================
# RULE GROUP ${ruleIndex}: ${userCount} user(s)
# ========================================
`;
        group.users.forEach(u => {
          script += `# - ${u.name} (${u.email})\n`;
        });
        script += `
Write-Host "Creating rules for Group ${ruleIndex} (${userCount} user(s))..." -ForegroundColor White

`;
        
        // SIGNATURE ONLY MODE
        if (scriptType === "signature") {
          // Create unique signature marker with hidden detectable text
          const uniqueSignatureMarker = `signature-${groupId}`;
          const uniqueText = `SIG_MARKER_${uniqueSignatureMarker}`;
          const wrappedSignature = `<div style="border-top: 1px solid #e9ecef; margin-top: 30px; padding-top: 20px;"><span style="display:none;font-size:0;height:0;width:0;line-height:0;overflow:hidden;">${uniqueText}</span>${group.signatureHtml}</div>`;
          const escapedSignature = wrappedSignature.replace(/'/g, "''");
          
          // Sanitize user name for rule name (remove special characters)
          const userName = group.users[0].name || group.users[0].email.split('@')[0];
          const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
          const ruleName = userCount > 1 ? `SIGNATURE_${sanitizedUserName}_Group${ruleIndex}` : `SIGNATURE_${sanitizedUserName}`;
          
          script += `# Signature rule for ${userCount} user(s)
New-TransportRule -Name "${ruleName}" \`
    -FromScope InOrganization \`
    -From "${userEmails}" \`
    -ApplyHtmlDisclaimerLocation Append \`
    -ApplyHtmlDisclaimerText '${escapedSignature}' \`
    -ExceptIfSubjectOrBodyContainsWords "${uniqueText}" \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Comments "Signature for ${userName}"

Write-Host "  ✓ Signature rule '${ruleName}' created for ${userCount} user(s)" -ForegroundColor Green
Write-Host ""

`;
        }
        // BANNER ONLY MODE
        else if (scriptType === "banner" && group.bannerHtml) {
          let finalBannerHtml = group.bannerHtml;
          
          // Create a unique identifier for this banner to prevent duplicates
          const bannerId = group.bannerId || `banner_${groupId}`;
          const uniqueMarker = `banner-id-${bannerId}`;
          const uniqueText = `BANNER_MARKER_${uniqueMarker.replace('banner-id-', '')}`;
          
          // Sanitize user name for rule name
          const userName = group.users[0].name || group.users[0].email.split('@')[0];
          const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
          const ruleName = userCount > 1 ? `BANNER_${sanitizedUserName}_Group${ruleIndex}` : `BANNER_${sanitizedUserName}`;
          
            // For banner-only mode with tracking, use DIRECT edge function URL with email for tracking
            if (group.bannerClickUrl && group.bannerId) {
              // Include user email in tracking URL for proper analytics
              const userEmail = encodeURIComponent(group.users[0].email);
              const trackingUrl = `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/track-banner-click?banner_id=${group.bannerId}&email=${userEmail}`;
              
              if (finalBannerHtml.includes('<a ') || finalBannerHtml.includes('<a>')) {
                finalBannerHtml = finalBannerHtml.replace(/href="[^"]*"/gi, `href="${trackingUrl}"`);
                finalBannerHtml = finalBannerHtml.replace(/href='[^']*'/gi, `href="${trackingUrl}"`);
                if (!finalBannerHtml.includes('target=')) {
                  finalBannerHtml = finalBannerHtml.replace(/<a /gi, '<a target="_blank" ');
                }
              } else {
                finalBannerHtml = `<a href="${trackingUrl}" target="_blank" style="display: block; text-decoration: none;">${group.bannerHtml}</a>`;
              }
          }
          
          // Add unique marker as hidden span to detect duplicates
          const wrappedBanner = `<div style="margin-bottom: 20px;"><span style="display:none;font-size:0;height:0;width:0;line-height:0;overflow:hidden;">${uniqueText}</span>${finalBannerHtml}</div>`;
          const escapedBanner = wrappedBanner.replace(/'/g, "''");
          const bannerPriority = Math.min(ruleIndex - 1, 3);
          
          script += `# Banner rule for ${userCount} user(s): ${userName}
# Exception marker: ${uniqueText} (prevents duplicates)
New-TransportRule -Name "${ruleName}" \`
    -FromScope InOrganization \`
    -From "${userEmails}" \`
    -ApplyHtmlDisclaimerLocation Prepend \`
    -ApplyHtmlDisclaimerText '${escapedBanner}' \`
    -ExceptIfSubjectOrBodyContainsWords "${uniqueText}" \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Priority ${bannerPriority} \`
    -Comments "Banner for ${userName}"

Write-Host "  ✓ Banner rule '${ruleName}' created for ${userCount} user(s)" -ForegroundColor Green
Write-Host "  ✓ Duplication prevention: ${uniqueText}" -ForegroundColor Cyan
Write-Host ""

`;
        }
        // BOTH MODE - TWO COMPLETELY SEPARATE RULES (No overlap, no duplicates)
        else if (scriptType === "both") {
          if (group.bannerHtml) {
            // Create unique identifiers for both banner and signature
            const bannerId = group.bannerId || `banner_${groupId}`;
            const uniqueBannerMarker = `banner-id-${bannerId}`;
            const uniqueSignatureMarker = `signature-${groupId}`;
            const bannerUniqueText = `BANNER_MARKER_${uniqueBannerMarker.replace('banner-id-', '')}`;
            const signatureUniqueText = `SIG_MARKER_${uniqueSignatureMarker}`;
            
            // Process banner with tracking - use DIRECT edge function URL with email for tracking
            let finalBannerHtml = group.bannerHtml;
            if (group.bannerClickUrl && group.bannerId) {
              // Include user email in tracking URL for proper analytics
              const userEmail = encodeURIComponent(group.users[0].email);
              const trackingUrl = `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/track-banner-click?banner_id=${group.bannerId}&email=${userEmail}`;
              
              if (finalBannerHtml.includes('<a ') || finalBannerHtml.includes('<a>')) {
                finalBannerHtml = finalBannerHtml.replace(/href="[^"]*"/gi, `href="${trackingUrl}"`);
                finalBannerHtml = finalBannerHtml.replace(/href='[^']*'/gi, `href="${trackingUrl}"`);
                if (!finalBannerHtml.includes('target=')) {
                  finalBannerHtml = finalBannerHtml.replace(/<a /gi, '<a target="_blank" ');
                }
              } else {
                finalBannerHtml = `<a href="${trackingUrl}" target="_blank" style="display: block; text-decoration: none;">${group.bannerHtml}</a>`;
              }
            }
            
            // Add unique markers to detect duplicates (hidden spans, not comments)
            const wrappedBanner = `<div style="margin-bottom: 20px;"><span style="display:none;font-size:0;height:0;width:0;line-height:0;overflow:hidden;">${bannerUniqueText}</span>${finalBannerHtml}</div>`;
            const escapedBanner = wrappedBanner.replace(/'/g, "''");
            
            const wrappedSignature = `<div style="border-top: 1px solid #e9ecef; margin-top: 30px; padding-top: 20px;"><span style="display:none;font-size:0;height:0;width:0;line-height:0;overflow:hidden;">${signatureUniqueText}</span>${group.signatureHtml}</div>`;
            const escapedSignature = wrappedSignature.replace(/'/g, "''");
            
            const bannerPriority = 0; // Highest priority (0-5 valid range) - ensures banner runs first
            const signaturePriority = 5; // Lowest priority (0-5 valid range) - ensures signature runs after
            
            // Generate unique rule name starting with user's name
            const userName = group.users[0].name || group.users[0].email.split('@')[0];
            const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
            const rulePrefix = userCount > 1 ? `MultiUser_${sanitizedUserName}` : sanitizedUserName;
            
            script += `# ========================================
# TWO COMPLETELY SEPARATE RULES (Group ${ruleIndex})
# ========================================
# Rule 1: BANNER ONLY (Prepend - appears ABOVE email body)
# Rule 2: SIGNATURE ONLY (Append - appears BELOW email body)
# Different names, priorities, locations = NO DUPLICATES
# Exception markers prevent duplication: ${bannerUniqueText}, ${signatureUniqueText}
# ========================================

Write-Host "Creating BANNER rule (Prepend ABOVE body)..." -ForegroundColor Cyan

# RULE 1: BANNER ONLY - Prepends content ABOVE the email body
New-TransportRule -Name "BANNER_${rulePrefix}_${groupId}" \`
    -FromScope InOrganization \`
    -From "${userEmails}" \`
    -ApplyHtmlDisclaimerLocation Prepend \`
    -ApplyHtmlDisclaimerText '${escapedBanner}' \`
    -ExceptIfSubjectOrBodyContainsWords "${bannerUniqueText}" \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Priority ${bannerPriority} \`
    -Comments "Banner for ${userName}"

Write-Host "  ✓ BANNER rule 'BANNER_${rulePrefix}_${groupId}' created - Priority ${bannerPriority} (ABOVE body)" -ForegroundColor Green
Write-Host "  ✓ Exception: ${bannerUniqueText}" -ForegroundColor Cyan
Write-Host ""

Write-Host "Creating SIGNATURE rule (Append BELOW body)..." -ForegroundColor Cyan

# RULE 2: SIGNATURE ONLY - Appends content BELOW the email body
New-TransportRule -Name "SIGNATURE_${rulePrefix}_${groupId}" \`
    -FromScope InOrganization \`
    -From "${userEmails}" \`
    -ApplyHtmlDisclaimerLocation Append \`
    -ApplyHtmlDisclaimerText '${escapedSignature}' \`
    -ExceptIfSubjectOrBodyContainsWords "${signatureUniqueText}" \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Priority ${signaturePriority} \`
    -Comments "Signature for ${userName}"

Write-Host "  ✓ SIGNATURE rule 'SIGNATURE_${rulePrefix}_${groupId}' created - Priority ${signaturePriority} (BELOW body)" -ForegroundColor Green
Write-Host "  ✓ Exception: ${signatureUniqueText}" -ForegroundColor Cyan
Write-Host ""
Write-Host "Result: Banner ABOVE body, Signature BELOW body - NO DUPLICATES" -ForegroundColor Green
Write-Host ""

`;
          } else {
            // Signature only - no banner
            const wrappedSignature = `<div style="border-top: 1px solid #e9ecef; margin-top: 30px; padding-top: 20px;">${group.signatureHtml}</div>`;
            const escapedSignature = wrappedSignature.replace(/'/g, "''");
            const exceptionText = group.users[0].name || group.users[0].email.split('@')[0];
            const exceptionEmail = group.users[0].email;
            
            // Generate unique rule name starting with user's name
            const userName = exceptionText;
            const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
            const rulePrefix = userCount > 1 ? `MultiUser_${sanitizedUserName}` : sanitizedUserName;
            
            script += `# Signature-only rule for ${userCount} user(s) - Appends BELOW email body

New-TransportRule -Name "${rulePrefix}_SIGNATURE_${groupId}" \`
    -FromScope InOrganization \`
    -From "${userEmails}" \`
    -ApplyHtmlDisclaimerLocation Append \`
    -ApplyHtmlDisclaimerText '${escapedSignature}' \`
    -ExceptIfSubjectOrBodyContainsWords "${exceptionText}", "${exceptionEmail}" \`
    -ApplyHtmlDisclaimerFallbackAction Wrap \`
    -Enabled $true \`
    -Priority 5 \`
    -Comments "Signature for ${userCount} user(s) - Append BELOW body"

Write-Host "  ✓ SIGNATURE rule created with duplication prevention (text + email, BELOW body)" -ForegroundColor Green
Write-Host ""

`;
          }
        }
      });

      script += `
Write-Host ""
Write-Host "=== STEP 4: Verifying Final Rules ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "ALL transport rules with disclaimers (signatures/banners):" -ForegroundColor Yellow
Get-TransportRule | Where-Object { $_.ApplyHtmlDisclaimerText -ne $null } | Format-Table Name, State, Priority, ApplyHtmlDisclaimerLocation, @{Label="UserCount";Expression={($_.From -split ',').Count}} -AutoSize

Write-Host ""
Write-Host "=== COMPLETED ===" -ForegroundColor Green
Write-Host "Script Type: ${scriptTypeLabel}" -ForegroundColor White
Write-Host "Total Rules Created: ${totalRules}" -ForegroundColor White
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

  // Filter assignments based on search query
  const filteredAssignments = assignments.filter(assignment => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      assignment.userEmail.toLowerCase().includes(query) ||
      assignment.userName.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deploy to Exchange Online</h2>
          <p className="text-muted-foreground">
            Manage user assignments and deploy signatures & banners to Microsoft Exchange
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsEmailPanelOpen(true)} 
            variant="outline"
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            Email Routing & DNS
          </Button>
          <Button onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> This is the <strong>unified deployment system</strong> for all email signatures and banners. 
          It generates PowerShell scripts that create Exchange transport rules for each user assignment. 
          When users send emails, Exchange automatically adds their assigned signature and banner.
          <br /><br />
          <strong>Important:</strong> This is the ONLY way to deploy to Exchange - all other deployment methods have been removed to prevent duplicate rules.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="assignments">User Assignments</TabsTrigger>
          <TabsTrigger value="deployment">Deployment Scripts</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="space-y-6 mt-6">
          {/* Create Assignment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Assign Banner & Signature to User
              </CardTitle>
              <CardDescription>
                Select a user and assign them an email signature and optional banner
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Select User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Signature *</Label>
                  <Select value={selectedSignature} onValueChange={setSelectedSignature}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a signature" />
                    </SelectTrigger>
                    <SelectContent>
                      {signatures.map((signature) => (
                        <SelectItem key={signature.id} value={signature.id}>
                          {signature.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Select Banner (Optional)</Label>
                  <Select value={selectedBanner} onValueChange={setSelectedBanner}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a banner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No banner</SelectItem>
                      {banners.map((banner) => (
                        <SelectItem key={banner.id} value={banner.id}>
                          {banner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleCreateAssignment} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Create Assignment
              </Button>
            </CardContent>
          </Card>

          {/* Current Assignments List */}
          <Card>
            <CardHeader>
              <CardTitle>Current Assignments</CardTitle>
              <CardDescription>
                Users with assigned signatures and banners (ready for deployment)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading assignments...</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No assignments found. Create assignments above to get started.
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">
                    {assignments.map((assignment) => (
                      <div key={assignment.userId} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-primary" />
                              <span className="font-medium">{assignment.userName}</span>
                              <Badge variant="outline">{assignment.userEmail}</Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span>Signature assigned</span>
                            </div>

                            {assignment.bannerHtml && (
                              <div className="flex items-center gap-2 text-sm">
                                <Image className="h-4 w-4 text-muted-foreground" />
                                <span>Banner assigned</span>
                                {assignment.bannerClickUrl && (
                                  <Badge variant="secondary" className="text-xs">Clickable</Badge>
                                )}
                              </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const { data } = await supabase
                                .from("user_email_assignments")
                                .select("id")
                                .eq("user_id", assignment.userId)
                                .eq("is_active", true)
                                .single();
                              if (data) {
                                handleRemoveAssignment(data.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployment" className="space-y-6 mt-6">

      {/* Domain-Wide Banner Assignment */}
      <Card className="p-6 border-2 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Domain-Wide Banner Deployment
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Deploy a banner to ALL users in your domain (overrides individual assignments)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="domainWideMode"
              checked={domainWideMode}
              onChange={(e) => setDomainWideMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="domainWideMode" className="cursor-pointer font-medium">
              Enable domain-wide banner deployment
            </Label>
          </div>

          {domainWideMode && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="domainName">Domain Name</Label>
                  <Input
                    id="domainName"
                    placeholder="e.g., cioaafrica.co"
                    value={domainName}
                    onChange={(e) => setDomainName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domainWideBanner">Banner</Label>
                  <Select value={domainWideBanner} onValueChange={setDomainWideBanner}>
                    <SelectTrigger id="domainWideBanner">
                      <SelectValue placeholder="Select banner" />
                    </SelectTrigger>
                    <SelectContent>
                      {banners.map((banner) => (
                        <SelectItem key={banner.id} value={banner.id}>
                          {banner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Note:</strong> This will generate a script that applies the selected banner to ALL users 
                  sending from @{domainName}. This is separate from individual user assignments and will apply 
                  regardless of user-specific settings.
                </AlertDescription>
              </Alert>

              <Button
                onClick={generatePowerShellScript}
                disabled={generating || !domainName || !domainWideBanner}
                className="w-full"
              >
                <Terminal className="h-4 w-4 mr-2" />
                {generating ? "Generating..." : "Generate Domain-Wide Banner Script"}
              </Button>
            </>
          )}
        </div>
      </Card>

      {!domainWideMode && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Current User Assignments ({filteredAssignments.length})</h3>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
            {filteredAssignments.length > 0 && (
              <Button
                onClick={toggleSelectAll}
                variant="outline"
                size="sm"
              >
                {selectedUserIds.size === filteredAssignments.length ? "Deselect All" : "Select All"}
              </Button>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading assignments...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {assignments.length === 0 ? 'No active user assignments found. Assign signatures to users first.' : 'No matching assignments found.'}
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] mb-6">
              <div className="space-y-3 pr-4">
                {filteredAssignments.map((assignment) => {
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
            </ScrollArea>

            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>How it works:</strong> Banners appear at the <strong>top</strong> of emails with spacing, 
                signatures at the <strong>bottom</strong> with a separator line. Banner links remain clickable. 
                Rules apply to both internal and external recipients.
              </AlertDescription>
            </Alert>

            <Separator className="my-6" />

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Script Type</h4>
                <RadioGroup value={scriptType} onValueChange={(value: any) => setScriptType(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="cursor-pointer">
                      Both (Signature + Banner) - Creates separate rules for each
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="signature" id="signature" />
                    <Label htmlFor="signature" className="cursor-pointer">
                      Signature Only - For selected users
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="banner" id="banner" />
                    <Label htmlFor="banner" className="cursor-pointer">
                      Banner Only - For selected users with banners assigned
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={generateCleanupScript}
                  variant="destructive"
                  className="w-full"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Step 1: Generate Cleanup Script (Remove ALL Old Rules)
                </Button>
                
                <Button
                  onClick={generatePowerShellScript}
                  disabled={generating || selectedUserIds.size === 0}
                  className="w-full"
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  {generating ? "Generating..." : `Step 2: Generate ${scriptType === "both" ? "Signature + Banner" : scriptType === "signature" ? "Signature Only" : "Banner Only"} Script for ${selectedUserIds.size} User${selectedUserIds.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      )}

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
        </TabsContent>
      </Tabs>

      <EmailRoutingPanel 
        isOpen={isEmailPanelOpen}
        onClose={() => setIsEmailPanelOpen(false)}
        profile={profile}
      />
    </div>
  );
};
