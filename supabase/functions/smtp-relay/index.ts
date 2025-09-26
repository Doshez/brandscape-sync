import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  from: string;
  to: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  messageId: string;
}

interface UserAssignment {
  user_email: string;
  signature_id: string;
  banner_ids: string[];
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const relaySecret = Deno.env.get('SMTP_RELAY_SECRET');

const supabase = createClient(supabaseUrl, supabaseKey);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('SMTP Relay: Received email processing request');

    // Validate relay secret for security
    const authHeader = req.headers.get('x-relay-secret');
    if (!relaySecret || authHeader !== relaySecret) {
      console.error('SMTP Relay: Invalid or missing relay secret');
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const emailData: EmailData = await req.json();
    console.log('SMTP Relay: Processing email from:', emailData.from);

    // Process email and add signature/banners
    const processedEmail = await processEmail(emailData);

    // Forward email to recipients
    const forwardResult = await forwardEmail(processedEmail);

    console.log('SMTP Relay: Email processed and forwarded successfully');

    return new Response(JSON.stringify({
      success: true,
      messageId: emailData.messageId,
      forwardResult
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('SMTP Relay Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

async function processEmail(emailData: EmailData): Promise<EmailData> {
  console.log('Processing email for user:', emailData.from);

  // Get user assignments for signature and banners
  const assignment = await getUserAssignment(emailData.from);
  
  if (!assignment) {
    console.log('No assignment found for user:', emailData.from);
    return emailData;
  }

  // Fetch signature content
  let signatureHtml = '';
  if (assignment.signature_id) {
    const signature = await getSignatureContent(assignment.signature_id);
    if (signature) {
      signatureHtml = signature.html_content;
    }
  }

  // Fetch banner content
  let bannersHtml = '';
  if (assignment.banner_ids.length > 0) {
    const banners = await getBannersContent(assignment.banner_ids);
    bannersHtml = banners.map(banner => 
      banner.click_url 
        ? `<a href="${banner.click_url}" target="_blank">${banner.html_content}</a>`
        : banner.html_content
    ).join('');
  }

  // Inject signature and banners into email body
  let modifiedHtmlBody = emailData.htmlBody;

  // Add banners at the top
  if (bannersHtml) {
    modifiedHtmlBody = bannersHtml + '<br>' + modifiedHtmlBody;
  }

  // Add signature at the bottom
  if (signatureHtml) {
    modifiedHtmlBody = modifiedHtmlBody + '<br><br>' + signatureHtml;
  }

  console.log('Email processed with signature and banners added');

  return {
    ...emailData,
    htmlBody: modifiedHtmlBody
  };
}

async function getUserAssignment(userEmail: string): Promise<UserAssignment | null> {
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', userEmail)
      .single();

    if (!profile) {
      return null;
    }

    // Get user assignments - this would be from a new table we'll create
    const { data: assignments } = await supabase
      .from('user_email_assignments')
      .select(`
        signature_id,
        banner_assignments:user_banner_assignments(banner_id)
      `)
      .eq('user_id', profile.user_id)
      .eq('is_active', true)
      .single();

    if (!assignments) {
      return null;
    }

    const bannerIds = assignments.banner_assignments?.map((ba: any) => ba.banner_id) || [];

    return {
      user_email: userEmail,
      signature_id: assignments.signature_id,
      banner_ids: bannerIds
    };

  } catch (error) {
    console.error('Error getting user assignment:', error);
    return null;
  }
}

async function getSignatureContent(signatureId: string) {
  try {
    const { data } = await supabase
      .from('email_signatures')
      .select('html_content')
      .eq('id', signatureId)
      .single();

    return data;
  } catch (error) {
    console.error('Error fetching signature:', error);
    return null;
  }
}

async function getBannersContent(bannerIds: string[]) {
  try {
    const { data } = await supabase
      .from('banners')
      .select('html_content, click_url')
      .in('id', bannerIds)
      .eq('is_active', true);

    return data || [];
  } catch (error) {
    console.error('Error fetching banners:', error);
    return [];
  }
}

async function forwardEmail(emailData: EmailData) {
  // This would integrate with your SMTP service (like Resend)
  // For now, we'll simulate the forwarding
  console.log('Forwarding email to:', emailData.to);
  
  // Here you would use Resend or another SMTP service to forward the email
  // For demonstration, we'll return a success response
  
  return {
    success: true,
    recipients: emailData.to,
    timestamp: new Date().toISOString()
  };
}

serve(handler);