import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-relay-secret',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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
    console.log('SMTP Relay: Received request from Mailgun webhook');
    console.log('Content-Type:', req.headers.get('content-type'));

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

    // Parse Mailgun webhook data (form data)
    const formData = await req.formData();
    
    const sender = formData.get('sender') as string;
    const recipient = formData.get('recipient') as string;
    const subject = formData.get('subject') as string;
    const htmlBody = formData.get('body-html') as string || formData.get('stripped-html') as string;
    const textBody = formData.get('body-plain') as string || formData.get('stripped-text') as string;
    const messageId = formData.get('Message-Id') as string;

    console.log('SMTP Relay: Processing email from:', sender, 'to:', recipient);

    if (!sender || !recipient || !subject) {
      console.error('SMTP Relay: Missing required email fields');
      return new Response(JSON.stringify({ error: 'Missing required email fields' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const emailData: EmailData = {
      from: sender,
      to: [recipient],
      subject,
      htmlBody: htmlBody || textBody || '',
      textBody,
      messageId: messageId || `${Date.now()}@smtp-relay`
    };

    // Process email and add signature/banners
    const processedEmail = await processEmail(emailData);

    // Forward the processed email using Resend
    console.log('SMTP Relay: Forwarding email via Resend');
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

  // Fetch banner content - select only 1 banner per email (rotation)
  let bannersHtml = '';
  if (assignment.banner_ids.length > 0) {
    // Use rotation based on current time to select 1 banner from available banners
    const bannerIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000)) % assignment.banner_ids.length;
    const selectedBannerId = assignment.banner_ids[bannerIndex];
    
    console.log(`Selected banner ${bannerIndex + 1} of ${assignment.banner_ids.length} available banners`);
    
    const banners = await getBannersContent([selectedBannerId]);
    if (banners.length > 0) {
      const banner = banners[0];
      bannersHtml = banner.click_url 
        ? `<a href="${banner.click_url}" target="_blank">${banner.html_content}</a>`
        : banner.html_content;
    }
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
        bannerIds = bannerAssignments?.map((ba: any) => ba.banner_id) || [];
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
  try {
    console.log('Forwarding email via Resend to:', emailData.to);
    
    const emailResponse = await resend.emails.send({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.htmlBody,
      text: emailData.textBody
    });

    console.log('Email sent successfully via Resend:', emailResponse);
    
    return {
      success: true,
      recipients: emailData.to,
      resendId: emailResponse.data?.id,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Error forwarding email via Resend:', error);
    throw new Error(`Failed to forward email: ${error.message}`);
  }
}

serve(handler);