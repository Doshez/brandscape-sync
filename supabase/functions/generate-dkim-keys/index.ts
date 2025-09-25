import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GenerateDKIMRequest {
  selectorName: string;
  domain: string;
  keySize?: 1024 | 2048 | 4096;
}

interface DKIMKeyPair {
  selector: string;
  privateKey: string;
  publicKey: string;
  dnsRecord: string;
  instructions: {
    serverConfig: string;
    dnsConfig: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { selectorName, domain, keySize = 2048 }: GenerateDKIMRequest = await req.json();

    if (!selectorName || !domain) {
      return new Response(
        JSON.stringify({ error: 'Selector name and domain are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating DKIM key pair for selector: ${selectorName}, domain: ${domain}, keySize: ${keySize}`);

    // Generate RSA key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-PSS",
        modulusLength: keySize,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: "SHA-256",
      },
      true, // extractable
      ["sign", "verify"]
    );

    // Export private key in PKCS#8 format
    const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));
    const privateKeyPEM = [
      "-----BEGIN PRIVATE KEY-----",
      ...privateKeyBase64.match(/.{1,64}/g) || [],
      "-----END PRIVATE KEY-----"
    ].join('\n');

    // Export public key in SPKI format
    const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
    
    // Convert to DKIM format (remove headers and newlines)
    const dkimPublicKey = publicKeyBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // Create DKIM DNS record
    const dnsRecord = `v=DKIM1; k=rsa; p=${dkimPublicKey}`;

    // Generate unique selector name if conflicts might exist
    const timestamp = Date.now().toString(36);
    const uniqueSelector = `${selectorName}-${timestamp}`;

    const result: DKIMKeyPair = {
      selector: uniqueSelector,
      privateKey: privateKeyPEM,
      publicKey: dkimPublicKey,
      dnsRecord: dnsRecord,
      instructions: {
        serverConfig: `Configure your mail server with:
Selector: ${uniqueSelector}
Domain: ${domain}
Private Key: Use the generated private key in your DKIM signing configuration
Key Algorithm: RSA-SHA256
Key Size: ${keySize} bits`,
        dnsConfig: `Add this TXT record to your DNS:
Name: ${uniqueSelector}._domainkey.${domain}
Type: TXT
Value: ${dnsRecord}
TTL: 3600`
      }
    };

    console.log(`Successfully generated DKIM key pair for selector: ${uniqueSelector}`);

    return new Response(
      JSON.stringify({
        success: true,
        keyPair: result,
        message: `DKIM key pair generated successfully for selector ${uniqueSelector}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error generating DKIM keys:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);