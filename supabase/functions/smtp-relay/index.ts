import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mailgun-signature',
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
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(resendApiKey);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('SMTP Relay: Received email processing request');
    
    // Parse Mailgun webhook data (multipart/form-data)
    const formData = await req.formData();
    
    // Extract email data from Mailgun webhook
    const sender = formData.get('sender') || formData.get('from');
    const recipient = formData.get('recipient') || formData.get('To');
    const subject = formData.get('subject');
    const htmlBody = formData.get('body-html') || formData.get('stripped-html') || '';
    const textBody = formData.get('body-plain') || formData.get('stripped-text') || '';
    const messageId = formData.get('Message-Id') || `${Date.now()}@relay`;

    if (!sender || !recipient || !subject) {
      console.error('SMTP Relay: Missing required email fields');
      return new Response(JSON.stringify({ error: 'Missing required email fields' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const emailData: EmailData = {
      from: sender.toString(),
      to: [recipient.toString()],
      subject: subject.toString(),
      htmlBody: htmlBody.toString(),
      textBody: textBody.toString(),
      messageId: messageId.toString()
    };

    console.log('SMTP Relay: Processing email from:', emailData.from, 'to:', emailData.to);

    // Process email and add signature/banners
    const processedEmail = await processEmail(emailData);

    // Forward the processed email using Resend
    const forwardResult = await forwardEmail(processedEmail);

    console.log('SMTP Relay: Email processed and forwarded successfully');

    return new Response(JSON.stringify({
      success: true,
      messageId: emailData.messageId,
      forwardResult,
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
    console.log('Forwarding email to:', emailData.to);
    
    // Forward the processed email using Resend
    const { data, error } = await resend.emails.send({
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.htmlBody,
      text: emailData.textBody
    });

    if (error) {
      console.error('Error forwarding email via Resend:', error);
      throw error;
    }

    console.log('Email forwarded successfully via Resend:', data);
    
    return {
      success: true,
      recipients: emailData.to,
      resendId: data?.id,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in forwardEmail:', error);
    throw error;
  }
}

serve(handler);