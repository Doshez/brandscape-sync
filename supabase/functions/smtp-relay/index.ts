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
  signature_id: string | null;
  banner_ids: string[];
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    if (!authHeader) {
      console.error('SMTP Relay: Missing relay secret header');
      return new Response(JSON.stringify({ error: 'Missing relay secret' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Verify relay secret against database
    const { data: relayConfig, error: relayError } = await supabase
      .from('smtp_relay_config')
      .select('relay_secret')
      .eq('relay_secret', authHeader)
      .eq('is_active', true)
      .single();

    if (relayError || !relayConfig) {
      console.error('SMTP Relay: Invalid relay secret', relayError);
      return new Response(JSON.stringify({ error: 'Invalid relay secret' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const emailData: EmailData = await req.json();
    console.log('SMTP Relay: Processing email from:', emailData.from);

    // Process email and add signature/banners
    const processedEmail = await processEmail(emailData);

    // For now, just return success without actually forwarding
    // In production, this would integrate with an actual SMTP service
    console.log('SMTP Relay: Email processed successfully');

    return new Response(JSON.stringify({
      success: true,
      messageId: emailData.messageId,
      processedEmail: {
        from: processedEmail.from,
        to: processedEmail.to,
        subject: processedEmail.subject,
        hasSignature: processedEmail.htmlBody !== emailData.htmlBody,
        timestamp: new Date().toISOString()
      }
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
    console.log('Getting user assignment for:', userEmail);
    
    // Get user profile - handle both authenticated users and manually created profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('email', userEmail)
      .limit(1)
      .single();

    if (profileError || !profile) {
      console.log('Profile not found for email:', userEmail, profileError);
      return null;
    }

    console.log('Found profile:', profile.id, 'user_id:', profile.user_id);

    // Get user's active email assignment using profile id as user_id for assignments
    const userIdForAssignment = profile.user_id || profile.id;
    
    const { data: emailAssignment, error: assignmentError } = await supabase
      .from('user_email_assignments')
      .select('id, signature_id')
      .eq('user_id', userIdForAssignment)
      .eq('is_active', true)
      .maybeSingle();

    if (assignmentError) {
      console.error('Error fetching email assignment:', assignmentError);
    }

    // Get user's banner assignments (only if email assignment exists)
    let bannerIds: string[] = [];
    if (emailAssignment?.id) {
      const { data: bannerAssignments, error: bannerError } = await supabase
        .from('user_banner_assignments')
        .select('banner_id')
        .eq('user_assignment_id', emailAssignment.id)
        .order('display_order');

      if (bannerError) {
        console.error('Error fetching banner assignments:', bannerError);
      } else {
        bannerIds = bannerAssignments?.map(ba => ba.banner_id) || [];
      }
    }

    console.log('User assignment found:', {
      signature_id: emailAssignment?.signature_id || null,
      banner_count: bannerIds.length
    });

    return {
      user_email: userEmail,
      signature_id: emailAssignment?.signature_id || null,
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