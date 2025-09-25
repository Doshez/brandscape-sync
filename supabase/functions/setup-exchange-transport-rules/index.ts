import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransportRuleRequest {
  domain: string;
  signature_html: string;
  rule_name: string;
  user_emails?: string[];
  selected_signature_id?: string;
  selected_banner_id?: string;
  target_user_ids?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      domain, 
      signature_html, 
      rule_name, 
      user_emails, 
      selected_signature_id, 
      selected_banner_id, 
      target_user_ids 
    }: TransportRuleRequest = await req.json();

    if (!domain || !signature_html || !rule_name) {
      throw new Error("Missing required parameters");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current user ID from JWT
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    let currentUserId = null;
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        currentUserId = user?.id;
      } catch (e) {
        console.warn('Could not get user from token:', e);
      }
    }

    // Generate PowerShell script for Exchange Online transport rule
    const powershellScript = generateTransportRuleScript({
      domain,
      signature_html,
      rule_name,
      user_emails
    });

    // Generate DNS records needed for email authentication
    const dnsRecords = generateDNSRecords(domain);

    // Store configuration in database
    const { data: config, error: configError } = await supabase
      .from('email_configurations')
      .insert({
        domain,
        signature_html,
        rule_name,
        powershell_script: powershellScript,
        dns_records: dnsRecords,
        target_users: user_emails,
        selected_signature_id,
        selected_banner_id,
        target_user_ids,
        created_by: currentUserId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (configError) {
      console.error('Config save error:', configError);
      throw new Error("Failed to save configuration");
    }

    // Create user assignments if we have target users and configuration
    if (target_user_ids && target_user_ids.length > 0 && config?.id) {
      const assignments = target_user_ids.map(userId => ({
        user_id: userId,
        configuration_id: config.id,
        signature_id: selected_signature_id || null,
        banner_id: selected_banner_id || null,
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
          powershell_script: powershellScript,
          dns_records: dnsRecords,
          assigned_users: user_emails?.length || 0,
          setup_instructions: [
            "1. Set up DNS records with your domain registrar",
            "2. Run the PowerShell script in Exchange Online PowerShell",
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
# Connect to Exchange Online first: Connect-ExchangeOnline

# Create transport rule to append signature
New-TransportRule -Name "${rule_name}" \`
  ${userCondition} \`
  -ApplyHtmlDisclaimerLocation Append \`
  -ApplyHtmlDisclaimerText "${escapedHtml}" \`
  -ApplyHtmlDisclaimerFallbackAction Wrap \`
  -Comments "Auto-generated signature rule for ${domain}" \`
  -Enabled $true

# Verify the rule was created
Get-TransportRule -Identity "${rule_name}" | Format-List Name,State,SenderDomainIs,From,ApplyHtmlDisclaimerText

Write-Host "Transport rule '${rule_name}' created successfully!" -ForegroundColor Green
Write-Host "Note: It may take 15-30 minutes for the rule to take effect." -ForegroundColor Yellow`;
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