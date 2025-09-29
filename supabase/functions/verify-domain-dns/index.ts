import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyDomainRequest {
  domain_id: string;
  domain_name: string;
  expected_value: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { domain_id, domain_name, expected_value }: VerifyDomainRequest = await req.json();

    if (!domain_id || !domain_name || !expected_value) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required parameters: domain_id, domain_name, expected_value" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Verifying DNS for domain: ${domain_name}`);
    console.log(`Expected TXT record value: ${expected_value}`);

    // Perform DNS TXT record lookup
    let dnsVerified = false;
    let errorMessage = "";

    try {
      // Use DNS over HTTPS (DoH) to query TXT records
      const dohUrl = `https://cloudflare-dns.com/dns-query?name=${domain_name}&type=TXT`;
      const dnsResponse = await fetch(dohUrl, {
        headers: {
          'Accept': 'application/dns-json',
        },
      });

      if (dnsResponse.ok) {
        const dnsData = await dnsResponse.json();
        console.log('DNS Response:', JSON.stringify(dnsData, null, 2));
        
        if (dnsData.Answer && Array.isArray(dnsData.Answer)) {
          // Check if any TXT record contains our expected value
          for (const record of dnsData.Answer) {
            if (record.type === 16) { // TXT record type
              const txtValue = record.data.replace(/"/g, ''); // Remove quotes
              console.log(`Found TXT record: ${txtValue}`);
              
              if (txtValue.includes(expected_value) || txtValue === expected_value) {
                dnsVerified = true;
                console.log('✅ DNS verification successful - TXT record found');
                break;
              }
            }
          }
        }

        if (!dnsVerified) {
          errorMessage = `TXT record not found. Expected: ${expected_value}`;
          console.log('❌ DNS verification failed - TXT record not found');
        }
      } else {
        errorMessage = "Failed to query DNS records";
        console.error('DNS query failed:', dnsResponse.status);
      }
    } catch (dnsError) {
      console.error('DNS lookup error:', dnsError);
      errorMessage = "DNS lookup failed. Please try again later.";
    }

    // Update domain verification status in database
    if (dnsVerified) {
      const { error: updateError } = await supabase
        .from("domains")
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", domain_id);

      if (updateError) {
        console.error('Database update error:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to update domain verification status",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          message: "Domain verified successfully!",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          verified: false,
          error: errorMessage || "DNS record not found",
          message: "Please ensure the TXT record is added correctly and try again.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("Verification error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);