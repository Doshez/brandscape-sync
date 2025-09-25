import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyDNSRequest {
  domain: string;
  records: Array<{
    type: string;
    name: string;
    expectedValue: string;
    recordKey: string;
  }>;
}

interface DNSVerificationResult {
  recordKey: string;
  verified: boolean;
  actualValue?: string;
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, records }: VerifyDNSRequest = await req.json();

    if (!domain || !records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing required parameters: domain, records" 
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Verifying DNS records for domain: ${domain}`);
    console.log(`Records to verify: ${records.length}`);

    const verificationResults: DNSVerificationResult[] = [];

    for (const record of records) {
      console.log(`Verifying ${record.type} record: ${record.name}`);
      
      try {
        let queryName = record.name;
        if (record.name === "@") {
          queryName = domain;
        } else if (!record.name.includes(".")) {
          queryName = `${record.name}.${domain}`;
        }

        // Use DNS over HTTPS (DoH) to query records
        const dohUrl = `https://cloudflare-dns.com/dns-query?name=${queryName}&type=${record.type}`;
        const dnsResponse = await fetch(dohUrl, {
          headers: {
            'Accept': 'application/dns-json',
          },
        });

        if (dnsResponse.ok) {
          const dnsData = await dnsResponse.json();
          console.log(`DNS Response for ${record.type} ${queryName}:`, JSON.stringify(dnsData, null, 2));
          
          let recordFound = false;
          let actualValue = "";

          if (dnsData.Answer && Array.isArray(dnsData.Answer)) {
            for (const dnsRecord of dnsData.Answer) {
              // Check record type matches
              const expectedType = getRecordTypeNumber(record.type);
              if (dnsRecord.type === expectedType) {
                actualValue = dnsRecord.data;
                
                // Clean up the actual value for comparison
                if (record.type === "TXT") {
                  actualValue = actualValue.replace(/"/g, '').trim();
                }
                if (record.type === "MX") {
                  // MX records include priority, so we just check if the domain is included
                  recordFound = actualValue.includes(record.expectedValue) || 
                               record.expectedValue.includes(actualValue.split(' ').slice(1).join(' '));
                } else if (record.type === "CNAME") {
                  // CNAME records might have trailing dots
                  const cleanActual = actualValue.replace(/\.$/, '');
                  const cleanExpected = record.expectedValue.replace(/\.$/, '');
                  recordFound = cleanActual === cleanExpected;
                } else {
                  // For TXT and other records, check if expected value is contained in actual
                  recordFound = actualValue.includes(record.expectedValue) || 
                               actualValue === record.expectedValue;
                }

                if (recordFound) {
                  console.log(`✅ ${record.type} record verified for ${queryName}`);
                  break;
                }
              }
            }
          }

          verificationResults.push({
            recordKey: record.recordKey,
            verified: recordFound,
            actualValue: actualValue || "Record not found",
            error: recordFound ? undefined : "Record value does not match expected value"
          });

          if (!recordFound) {
            console.log(`❌ ${record.type} record verification failed for ${queryName}`);
            console.log(`Expected: ${record.expectedValue}`);
            console.log(`Actual: ${actualValue || "Not found"}`);
          }
        } else {
          console.error(`DNS query failed for ${queryName}:`, dnsResponse.status);
          verificationResults.push({
            recordKey: record.recordKey,
            verified: false,
            error: `DNS query failed: ${dnsResponse.status}`
          });
        }
      } catch (recordError) {
        console.error(`Error verifying ${record.type} record ${record.name}:`, recordError);
        verificationResults.push({
          recordKey: record.recordKey,
          verified: false,
          error: `Verification error: ${recordError instanceof Error ? recordError.message : String(recordError)}`
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        results: verificationResults,
        summary: {
          total: verificationResults.length,
          verified: verificationResults.filter(r => r.verified).length,
          failed: verificationResults.filter(r => !r.verified).length
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("DNS verification error:", error);
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

// Helper function to get DNS record type numbers
function getRecordTypeNumber(type: string): number {
  switch (type.toUpperCase()) {
    case "A": return 1;
    case "CNAME": return 5;
    case "MX": return 15;
    case "TXT": return 16;
    case "AAAA": return 28;
    default: return 0;
  }
}

serve(handler);