import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FindDKIMRequest {
  domain: string;
}

interface DKIMSelectorResult {
  selector: string;
  found: boolean;
  record?: string;
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain }: FindDKIMRequest = await req.json();
    
    if (!domain || typeof domain !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Domain is required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    console.log(`Finding DKIM selectors for domain: ${domain}`);

    // Common DKIM selectors to check
    const commonSelectors = [
      'selector1', 'selector2', 'default', 'dkim', 'key1', 'key2',
      'google', 'gmail', 'office365', 'exchangeonline', 'mx1', 'mx2',
      's1', 's2', 'mail', 'email', 'k1', 'k2'
    ];

    const results: DKIMSelectorResult[] = [];

    // Check each common selector
    for (const selector of commonSelectors) {
      try {
        const dkimDomain = `${selector}._domainkey.${domain}`;
        console.log(`Checking DKIM selector: ${selector} for ${dkimDomain}`);
        
        // Use Cloudflare DNS over HTTPS for DNS resolution
        const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dkimDomain)}&type=TXT`;
        
        const response = await fetch(dohUrl, {
          headers: {
            'Accept': 'application/dns-json',
          },
        });

        if (!response.ok) {
          console.log(`DNS query failed for ${selector}: ${response.status}`);
          results.push({
            selector,
            found: false,
            error: `DNS query failed: ${response.status}`
          });
          continue;
        }

        const dnsData = await response.json();
        console.log(`DNS response for ${selector}:`, JSON.stringify(dnsData, null, 2));

        // Check if we have TXT records in the response
        if (dnsData.Status === 0 && dnsData.Answer) {
          const txtRecords = dnsData.Answer.filter((record: any) => record.type === 16); // TXT records
          
          if (txtRecords.length > 0) {
            for (const record of txtRecords) {
              const recordData = record.data.replace(/"/g, ''); // Remove quotes
              console.log(`Found TXT record for ${selector}: ${recordData}`);
              
              // Check if this looks like a DKIM record (contains v=DKIM1)
              if (recordData.includes('v=DKIM1')) {
                console.log(`✅ Found valid DKIM record for selector: ${selector}`);
                results.push({
                  selector,
                  found: true,
                  record: recordData
                });
                break; // Found a valid DKIM record for this selector
              }
            }
          }
        }
        
        // If we didn't find a DKIM record for this selector, mark as not found
        if (!results.find(r => r.selector === selector && r.found)) {
          results.push({
            selector,
            found: false
          });
        }

      } catch (error) {
        console.error(`Error checking selector ${selector}:`, error);
        results.push({
          selector,
          found: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Filter to show found selectors first, then organize results
    const foundSelectors = results.filter(r => r.found);
    const notFoundSelectors = results.filter(r => !r.found);

    console.log(`DKIM search completed. Found: ${foundSelectors.length}, Not found: ${notFoundSelectors.length}`);

    return new Response(JSON.stringify({
      domain,
      foundSelectors,
      checkedSelectors: commonSelectors,
      totalChecked: results.length,
      message: foundSelectors.length > 0 
        ? `Found ${foundSelectors.length} DKIM selector(s)` 
        : 'No DKIM selectors found. You may need to configure DKIM records with your email provider first.'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in find-dkim-selector function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);