import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-relay-secret',
};

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

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
    console.log('SMTP Relay: Received request');
    console.log('Content-Type:', req.headers.get('content-type'));
    console.log('User-Agent:', req.headers.get('user-agent'));

    // Optional: Validate relay secret for security (only if provided)
    const authHeader = req.headers.get('x-relay-secret');
    if (authHeader) {
      console.log('Validating relay secret...');
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
      console.log('Relay secret validated successfully');
    } else {
      console.log('No relay secret provided - allowing request (SendGrid Inbound Parse mode)');
    }

    // Check if email was already processed (prevent loops)
    const alreadyProcessed = req.headers.get('x-processed-by-relay') === 'true' ||
                             req.headers.get('x-skip-transport-rule') === 'true';
    
    if (alreadyProcessed) {
      console.log('Email already processed - skipping to prevent loop');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email already processed, skipping duplicate' 
      }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check content type to determine how to parse the request
    const contentType = req.headers.get('content-type') || '';
    let sender: string;
    let recipient: string | string[];
    let subject: string;
    let htmlBody: string;
    let textBody: string;
    let messageId: string;

    if (contentType.includes('application/json')) {
      // Handle JSON format (from test emails or direct API calls)
      const jsonData = await req.json();
      sender = jsonData.from;
      recipient = jsonData.to;
      subject = jsonData.subject;
      htmlBody = jsonData.htmlBody || jsonData.html || jsonData.text || '';
      textBody = jsonData.textBody || jsonData.text || '';
      messageId = jsonData.messageId || `test-${Date.now()}@relay`;
      
      console.log('SMTP Relay: Processing JSON email from:', sender, 'to:', recipient);
      console.log('JSON email has html:', !!htmlBody, 'text:', !!textBody);
    } else {
      // Handle form data (from SendGrid Inbound Parse webhook)
      const formData = await req.formData();
      sender = formData.get('from') as string;
      recipient = formData.get('to') as string;
      subject = formData.get('subject') as string;
      
      // SendGrid sends the full raw email in the 'email' field
      const rawEmail = formData.get('email') as string;
      
      // Try to extract HTML from raw email (basic parsing)
      if (rawEmail) {
        // Look for HTML content between Content-Type: text/html and next boundary
        const htmlMatch = rawEmail.match(/Content-Type: text\/html[^\n]*\n[^\n]*\n([\s\S]*?)(?=\n--)/);
        if (htmlMatch && htmlMatch[1]) {
          htmlBody = htmlMatch[1].trim();
        }
        
        // Look for plain text content
        const textMatch = rawEmail.match(/Content-Type: text\/plain[^\n]*\n[^\n]*\n([\s\S]*?)(?=\n--)/);
        if (textMatch && textMatch[1]) {
          textBody = textMatch[1].trim();
        }
      }
      
      // Fallback to direct fields if available
      if (!htmlBody) {
        htmlBody = (formData.get('html') as string) || 
                   (formData.get('body-html') as string) || 
                   textBody || '';
      }
      
      if (!textBody) {
        textBody = (formData.get('text') as string) || 
                   (formData.get('body-plain') as string) || '';
      }
      
      messageId = formData.get('headers') as string;
      
      console.log('SMTP Relay: Processing form data email from:', sender, 'to:', recipient);
      console.log('Form data has html:', !!htmlBody, 'text:', !!textBody);
    }

    // Normalize recipient to array format
    const recipientArray = Array.isArray(recipient) ? recipient : [recipient];
    const primaryRecipient = recipientArray[0];

    if (!sender || !primaryRecipient || !subject) {
      console.error('SMTP Relay: Missing required email fields');
      return new Response(JSON.stringify({ error: 'Missing required email fields' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const emailData: EmailData = {
      from: sender,
      to: recipientArray,
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

// Helper function to extract email address from display name format
function extractEmailAddress(emailString: string): string {
  // Check if email is in format "Display Name <email@domain.com>"
  const match = emailString.match(/<([^>]+)>/);
  if (match) {
    return match[1].trim();
  }
  
  // Otherwise, return the string as-is (assuming it's already just an email)
  return emailString.trim();
}

async function processEmail(emailData: EmailData): Promise<EmailData> {
  console.log('Processing email for user:', emailData.from);

  // Extract just the email address from the sender field
  const senderEmail = extractEmailAddress(emailData.from);
  console.log('Extracted email address:', senderEmail);

  // Ensure we have some content to work with
  if (!emailData.htmlBody && !emailData.textBody) {
    console.log('Warning: Email has no content body');
    // Set a minimal HTML body to avoid Resend rejection
    emailData.htmlBody = '<p>This is an automated email.</p>';
    emailData.textBody = 'This is an automated email.';
  }

  // Get user assignments for signature and banners
  const assignment = await getUserAssignment(senderEmail);
  
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
  let modifiedHtmlBody = emailData.htmlBody || '';

  // Ensure we have a proper HTML structure
  let bodyContent = modifiedHtmlBody;
  
  // Add banners at the top ONLY if not already present (prevent duplicates)
  if (bannersHtml) {
    const hasBannerMarker = modifiedHtmlBody.includes('<!-- tracking-applied -->') || 
                           modifiedHtmlBody.includes('data-tracking-applied="true"') ||
                           modifiedHtmlBody.includes('banner-view-pixel');
    
    if (!hasBannerMarker) {
      console.log('Adding banner to email (no existing banner detected)');
      // Add banner at the very top with proper spacing
      bodyContent = `
        <div style="margin-bottom: 20px;">
          ${bannersHtml}
        </div>
        ${bodyContent}
      `;
    } else {
      console.log('Banner already exists in email - skipping duplicate banner');
    }
  }

  // Add signature at the bottom ONLY if not already present (prevent duplicates)
  if (signatureHtml) {
    const hasSignature = modifiedHtmlBody.includes(signatureHtml.substring(0, 50));
    
    if (!hasSignature) {
      console.log('Adding signature to email (no existing signature detected)');
      // Add signature at the bottom with proper spacing
      bodyContent = `
        ${bodyContent}
        <div style="margin-top: 20px;">
          ${signatureHtml}
        </div>
      `;
    } else {
      console.log('Signature already exists in email - skipping duplicate signature');
    }
  }

  modifiedHtmlBody = bodyContent;

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
    console.log('Forwarding email via SendGrid to:', emailData.to);
    
    // Ensure we have at least HTML or text content
    const html = emailData.htmlBody || undefined;
    const text = emailData.textBody || (emailData.htmlBody ? stripHtml(emailData.htmlBody) : undefined);
    
    // Validate we have content to send
    if (!html && !text) {
      throw new Error('Email has no content - both HTML and text body are empty');
    }
    
    console.log('Sending email with html:', !!html, 'text:', !!text);
    
    const msg = {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject,
      text: text,
      html: html,
      headers: {
        'X-Processed-By-Relay': 'true',
        'X-Skip-Transport-Rule': 'true'
      }
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(msg),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid API error:', response.status, errorText);
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    console.log('Email sent successfully via SendGrid');
    
    return {
      success: true,
      recipients: emailData.to,
      sendgridResponse: response.status,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Error forwarding email via SendGrid:', error);
    throw new Error(`Failed to forward email: ${error.message}`);
  }
}

// Helper function to strip HTML tags for text version
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

serve(handler);