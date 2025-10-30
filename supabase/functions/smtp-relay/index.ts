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
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
  }>;
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
    let attachments: Array<{ content: string; filename: string; type: string }> = [];

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
        const htmlMatch = rawEmail.match(/Content-Type: text\/html[^\n]*\n([^\n]*\n)?([\s\S]*?)(?=\n--)/);
        if (htmlMatch && htmlMatch[2]) {
          let content = htmlMatch[2].trim();
          // Check if content is base64 encoded by looking at the Content-Transfer-Encoding header
          const isBase64 = htmlMatch[1] && htmlMatch[1].includes('base64');
          if (isBase64) {
            try {
              // Decode base64 content
              content = atob(content.replace(/\n/g, ''));
            } catch (e) {
              console.error('Failed to decode base64 HTML:', e);
            }
          }
          htmlBody = content;
        }
        
        // Look for plain text content
        const textMatch = rawEmail.match(/Content-Type: text\/plain[^\n]*\n([^\n]*\n)?([\s\S]*?)(?=\n--)/);
        if (textMatch && textMatch[2]) {
          let content = textMatch[2].trim();
          // Check if content is base64 encoded
          const isBase64 = textMatch[1] && textMatch[1].includes('base64');
          if (isBase64) {
            try {
              // Decode base64 content
              content = atob(content.replace(/\n/g, ''));
            } catch (e) {
              console.error('Failed to decode base64 text:', e);
            }
          }
          textBody = content;
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
      
      // Extract attachments from form data
      const attachmentCount = parseInt(formData.get('attachments') as string || '0');
      if (attachmentCount > 0) {
        for (let i = 1; i <= attachmentCount; i++) {
          const attachmentFile = formData.get(`attachment${i}`) as File;
          if (attachmentFile) {
            // Read file as base64
            const buffer = await attachmentFile.arrayBuffer();
            const base64Content = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            
            attachments.push({
              content: base64Content,
              filename: attachmentFile.name,
              type: attachmentFile.type || 'application/octet-stream'
            });
          }
        }
        console.log(`Extracted ${attachments.length} attachment(s)`);
      }
      
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
      messageId: messageId || `${Date.now()}@smtp-relay`,
      attachments: attachments.length > 0 ? attachments : undefined
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

  // Preserve exact Outlook HTML body - only add banner (top) and signature (bottom)
  const originalHtmlBody = emailData.htmlBody || '';

  // Extract preheader text (first 150 chars of body for inbox preview) - remove styles first
  const stripHtmlTags = (html: string) => {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags first
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
      .replace(/<[^>]*>/g, ' ') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const preheaderText = stripHtmlTags(originalHtmlBody).substring(0, 150);
  
  // Build email: Preheader (hidden) -> Banner -> Original Body (unchanged) -> Signature
  let bodyContent = '';
  
  // 1. Add hidden preheader for inbox preview
  if (preheaderText) {
    bodyContent += `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheaderText}</div>\n`;
  }
  
  // 2. Prepend banner at top (only if not already present)
  if (bannersHtml) {
    const hasBannerMarker = originalHtmlBody.includes('<!-- tracking-applied -->') || 
                           originalHtmlBody.includes('data-tracking-applied="true"') ||
                           originalHtmlBody.includes('banner-view-pixel');
    
    if (!hasBannerMarker) {
      console.log('Prepending banner to email header');
      bodyContent += bannersHtml + '\n';
    } else {
      console.log('Banner already exists in email - skipping duplicate banner');
    }
  }
  
  // 3. Add the ORIGINAL body content without any modifications
  bodyContent += originalHtmlBody;

  // 4. Append signature at footer (only if not already present)
  if (signatureHtml) {
    const hasSignature = originalHtmlBody.includes(signatureHtml.substring(0, 50));
    
    if (!hasSignature) {
      console.log('Appending signature to email footer');
      bodyContent += '\n' + signatureHtml;
    } else {
      console.log('Signature already exists in email - skipping duplicate signature');
    }
  }

  // Final HTML body with banner, original content, and signature
  const finalHtmlBody = bodyContent;

  console.log('Email processed with signature and banners added');

  return {
    ...emailData,
    htmlBody: finalHtmlBody
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
    
    // Extract email from sender if in "Name <email>" format
    const fromEmail = extractEmailAddress(emailData.from);
    
    // Extract display name from sender (if available) - preserve original Outlook name
    let displayName = '';
    const displayNameMatch = emailData.from.match(/^["']?([^"'<]+?)["']?\s*</);
    if (displayNameMatch) {
      displayName = displayNameMatch[1].trim();
    } else {
      // If no display name in angle brackets, check if the whole string is "Name" before @
      const nameBeforeAt = emailData.from.split('@')[0];
      displayName = nameBeforeAt.replace(/[._-]/g, ' ').trim();
    }
    
    console.log('Original sender:', emailData.from);
    console.log('Extracted email:', fromEmail);
    console.log('Extracted display name:', displayName);
    
    // Improve text content to match HTML content better (for better Gmail categorization)
    let improvedText = text;
    if (!text && html) {
      // If no text version, create a better one from HTML
      improvedText = stripHtml(html);
    } else if (text && html) {
      // Ensure text has meaningful content, not just stripped HTML
      const textLength = text.trim().length;
      const htmlStripped = stripHtml(html);
      // If text is too short compared to HTML, use the stripped version
      if (textLength < htmlStripped.length * 0.5) {
        improvedText = htmlStripped;
      }
    }
    
    // Build content array for SendGrid v3 API - ALWAYS put text/plain first
    const content = [];
    if (improvedText) {
      content.push({ type: 'text/plain', value: improvedText });
    }
    if (html) {
      content.push({ type: 'text/html', value: html });
    }
    
    // Format recipients for SendGrid v3 API
    const toEmails = emailData.to.map(recipient => ({
      email: extractEmailAddress(recipient)
    }));
    
    // Generate unique message ID for threading
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@${fromEmail.split('@')[1]}>`;
    
    // SendGrid v3 API format - optimized for Primary inbox
    const msg = {
      personalizations: [{
        to: toEmails,
        subject: emailData.subject
      }],
      from: {
        email: fromEmail,  // Use original Outlook sender email
        name: displayName   // Use original Outlook sender name
      },
      reply_to: {
        email: fromEmail,  // Ensure replies go to original sender
        name: displayName
      },
      content: content,
      headers: {
        // Personal email indicators
        'X-Priority': '3',
        'Importance': 'Normal',
        'X-MSMail-Priority': 'Normal',
        'Message-ID': messageId,
        'X-Mailer': 'Microsoft Outlook 16.0',  // Mimic Outlook
        'X-Original-Sender': fromEmail,
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        // Threading support
        'References': emailData.messageId || messageId,
        'In-Reply-To': emailData.messageId || messageId
      },
      custom_args: {
        'x-processed-by-relay': 'true',
        'x-skip-transport-rule': 'true',
        'x-original-sender': fromEmail
      },
      // Critical: Disable all tracking
      tracking_settings: {
        click_tracking: { enable: false },
        open_tracking: { enable: false },
        subscription_tracking: { enable: false },
        ganalytics: { enable: false }
      },
      // Use a higher mail priority for personal emails
      mail_settings: {
        bypass_list_management: { enable: true }
      }
    };
    
    // Add attachments if present
    if (emailData.attachments && emailData.attachments.length > 0) {
      msg.attachments = emailData.attachments.map(att => ({
        content: att.content,
        filename: att.filename,
        type: att.type,
        disposition: 'attachment'
      }));
      console.log(`Adding ${emailData.attachments.length} attachment(s) to email`);
    }

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
    .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove style tags and content (case insensitive, dotall)
    .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove script tags
    .replace(/<[^>]+>/g, '') // Remove all other HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

serve(handler);