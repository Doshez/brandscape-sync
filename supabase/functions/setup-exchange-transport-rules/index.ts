import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransportRuleRequest {
  domain: string;
  rule_name: string;
  user_assignments: Array<{
    user_id: string;
    email: string;
    signature_id?: string;
    banner_id?: string;
    combined_html: string;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      domain, 
      rule_name, 
      user_assignments 
    }: TransportRuleRequest = await req.json();

    if (!domain || !rule_name || !user_assignments || user_assignments.length === 0) {
      throw new Error("Missing required parameters");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')!
        }
      }
    });

    // Get current user from JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error("Authentication required");
    }
    
    const currentUserId = user.id;

    // Generate PowerShell scripts for each user (since each might have different signatures)
    const powershellScripts: Array<{
      rule_name: string;
      script: string;
      user_count: number;
      users: string[];
    }> = [];
    const allUserEmails = user_assignments.map(ua => ua.email);

    // If all users have the same signature/banner combination, create one rule
    // Otherwise, create individual rules for different combinations
    const signatureCombinations = new Map<string, Array<typeof user_assignments[0]>>();
    
    user_assignments.forEach(assignment => {
      const key = `${assignment.signature_id || 'none'}_${assignment.banner_id || 'none'}`;
      if (!signatureCombinations.has(key)) {
        signatureCombinations.set(key, []);
      }
      signatureCombinations.get(key)!.push(assignment);
    });

    let ruleCounter = 1;
    signatureCombinations.forEach((assignments, key) => {
      const firstAssignment = assignments[0];
      const userEmails = assignments.map(a => a.email);
      const ruleName = signatureCombinations.size > 1 
        ? `${rule_name}_${ruleCounter}` 
        : rule_name;

      const script = generateTransportRuleScript({
        domain,
        signature_html: firstAssignment.combined_html,
        rule_name: ruleName,
        user_emails: userEmails
      });

      powershellScripts.push({
        rule_name: ruleName,
        script,
        user_count: userEmails.length,
        users: userEmails
      });

      ruleCounter++;
    });

    // Generate DNS records needed for email authentication
    const dnsRecords = generateDNSRecords(domain);

    // Store configuration in database
    const { data: config, error: configError } = await supabase
      .from('email_configurations')
      .insert({
        domain,
        signature_html: JSON.stringify(user_assignments.map(ua => ({
          email: ua.email,
          html: ua.combined_html
        }))),
        rule_name,
        powershell_script: powershellScripts.map(ps => ps.script).join('\n\n# --- Next Rule ---\n\n'),
        dns_records: dnsRecords,
        target_users: allUserEmails,
        target_user_ids: user_assignments.map(ua => ua.user_id),
        created_by: currentUserId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (configError) {
      console.error('Config save error:', configError);
      throw new Error("Failed to save configuration");
    }

    // Create individual user assignments
    if (config?.id) {
      const assignments = user_assignments.map(ua => ({
        user_id: ua.user_id,
        configuration_id: config.id,
        signature_id: ua.signature_id || null,
        banner_id: ua.banner_id || null,
        assigned_by: currentUserId
      }));

      const { error: assignmentError } = await supabase
        .from('user_assignments')
        .insert(assignments);

      if (assignmentError) {
        console.error('Assignment error:', assignmentError);
        // Don't fail the entire request, just log the error
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Exchange transport rule configuration generated",
        configuration: {
          id: config.id,
          powershell_script: powershellScripts.map(ps => ps.script).join('\n\n# --- Next Rule ---\n\n'),
          powershell_scripts: powershellScripts,
          dns_records: dnsRecords,
          assigned_users: user_assignments.length,
          rule_count: powershellScripts.length,
          setup_instructions: [
            "1. Set up DNS records with your domain registrar",
            `2. Run the PowerShell script${powershellScripts.length > 1 ? 's' : ''} in Exchange Online PowerShell`,
            "3. Wait 15-30 minutes for transport rules to take effect",
            "4. Test by sending an email from affected users"
          ]
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Transport rule setup error:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateTransportRuleScript(config: {
  domain: string;
  signature_html: string;
  rule_name: string;
  user_emails?: string[];
}) {
  const { domain, signature_html, rule_name, user_emails } = config;
  
  // Escape HTML for PowerShell
  const escapedHtml = signature_html
    .replace(/"/g, '""')
    .replace(/\r?\n/g, ' ');

  const userCondition = user_emails && user_emails.length > 0
    ? `-From @("${user_emails.join('","')}")`
    : `-SenderDomainIs "${domain}"`;

  return `# Exchange Online PowerShell Script
# This script requires the Exchange Online Management module

# Install module if not already installed (run once)
# Install-Module -Name ExchangeOnlineManagement -Force -AllowClobber

# Import the Exchange Online Management module
Import-Module ExchangeOnlineManagement

# Connect to Exchange Online (you'll be prompted for credentials)
Write-Host "Connecting to Exchange Online..." -ForegroundColor Cyan
Connect-ExchangeOnline -ShowBanner:\$false

# Check if rule already exists and remove it
\$existingRule = Get-TransportRule -Identity "${rule_name}" -ErrorAction SilentlyContinue
if (\$existingRule) {
    Write-Host "Removing existing rule '${rule_name}'..." -ForegroundColor Yellow
    Remove-TransportRule -Identity "${rule_name}" -Confirm:\$false
}

# Create transport rule to append signature
Write-Host "Creating transport rule '${rule_name}'..." -ForegroundColor Cyan
New-TransportRule -Name "${rule_name}" \\\`
  ${userCondition} \\\`
  -ApplyHtmlDisclaimerLocation Append \\\`
  -ApplyHtmlDisclaimerText "${escapedHtml}" \\\`
  -ApplyHtmlDisclaimerFallbackAction Wrap \\\`
  -Comments "Auto-generated signature rule for ${domain}" \\\`
  -Enabled \$true

# Verify the rule was created
Write-Host "" -NoNewline
Write-Host "Verifying rule configuration..." -ForegroundColor Cyan
Get-TransportRule -Identity "${rule_name}" | Format-List Name,State,SenderDomainIs,From,ApplyHtmlDisclaimerText

Write-Host "" -NoNewline
Write-Host "Transport rule '${rule_name}' created successfully!" -ForegroundColor Green
Write-Host "Note: It may take 15-30 minutes for the rule to take effect." -ForegroundColor Yellow
Write-Host "" -NoNewline
Write-Host "To disconnect from Exchange Online, run: Disconnect-ExchangeOnline" -ForegroundColor Cyan`;
}

function generateDNSRecords(domain: string) {
  return {
    required_records: [
      {
        type: "TXT",
        name: "@",
        value: `v=spf1 include:spf.protection.outlook.com ~all`,
        description: "SPF record for Office 365"
      },
      {
        type: "TXT", 
        name: "_dmarc",
        value: `v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@${domain}; fo=1`,
        description: "DMARC policy record"
      },
      {
        type: "CNAME",
        name: "autodiscover",
        value: "autodiscover.outlook.com",
        description: "Autodiscover for Outlook configuration"
      }
    ],
    optional_records: [
      {
        type: "TXT",
        name: "selector1._domainkey",
        value: "[Generated by Office 365 - check admin center]",
        description: "DKIM selector 1 (get from Office 365 admin)"
      },
      {
        type: "TXT",
        name: "selector2._domainkey", 
        value: "[Generated by Office 365 - check admin center]",
        description: "DKIM selector 2 (get from Office 365 admin)"
      }
    ],
    setup_instructions: [
      "1. Add these DNS records at your domain registrar",
      "2. In Office 365 admin center, go to Security & Compliance",
      "3. Enable DKIM for your domain to get the DKIM keys",
      "4. Wait for DNS propagation (up to 48 hours)",
      "5. Verify records using tools like MXToolbox or DNSChecker"
    ]
  };
}

serve(handler);