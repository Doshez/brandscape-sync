# SMTP Relay Edge Function

This edge function receives emails from SendGrid Inbound Parse, adds email signatures and banners, then forwards them to recipients via Resend.

## Architecture Flow

```
User (Outlook) → Exchange Transport Rule → SendGrid Inbound Parse → This Edge Function → Adds Signature/Banner → Resend → Recipient
```

## Setup Instructions

### Step 1: Configure SendGrid Inbound Parse

1. Go to [SendGrid Inbound Parse Settings](https://app.sendgrid.com/settings/parse)
2. Click **"Add Host & URL"**
3. Configure:
   - **Subdomain**: `mail` (or any subdomain you prefer)
   - **Domain**: Your company domain (e.g., `cioafrica.co`)
   - **Destination URL**: `https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/smtp-relay`
   - **Check**: "POST the raw, full MIME message"
4. Click **Save**

### Step 2: Add DNS Records

Add these records to your domain's DNS:

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | mail.yourdomain.com | mx.sendgrid.net | 10 |

**Important**: Replace `yourdomain.com` with your actual domain.

### Step 3: Disable SendGrid IP Whitelisting

1. Go to SendGrid → Settings → Access Management → IP Access Management
2. **Disable** IP Access Management (Supabase uses dynamic IPs)

### Step 4: Configure Exchange Transport Rule

Run this PowerShell command in Exchange Online:

```powershell
Connect-ExchangeOnline

New-TransportRule -Name "Email Signature System" `
  -SentToScope NotInOrganization `
  -BlindCopyTo "relay@mail.yourdomain.com" `
  -Priority 0
```

**Replace** `relay@mail.yourdomain.com` with a full email address using your subdomain (e.g., `relay@mail.cioafrica.co`).

## How It Works

1. **User sends email** from Outlook/Exchange
2. **Exchange transport rule** intercepts and BCC's to `mail.yourdomain.com`
3. **SendGrid Inbound Parse** receives the email and POSTs to this edge function
4. **Edge function processes**:
   - Extracts sender email
   - Looks up user's signature and banner assignments
   - Injects signature (at bottom) and banner (at top)
   - Prevents duplicates if signature/banner already exists
5. **Forwards via Resend** to the original recipient

## Required Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `RESEND_API_KEY` - Resend API key for sending emails

## Testing

### Test via SendGrid (Production Flow)

Send a test email from your Outlook/Exchange account to any external recipient.

### Test via Direct API Call

```bash
curl -X POST https://ddoihmeqpjjiumqndjgk.supabase.co/functions/v1/smtp-relay \
  -H "Content-Type: application/json" \
  -d '{
    "from": "sender@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "Test Email",
    "htmlBody": "<p>This is a test email</p>"
  }'
```

## Troubleshooting

### Email not being processed

1. **Check SendGrid Activity Feed**: Verify emails are reaching Inbound Parse
2. **Check Edge Function Logs**: View at [Function Logs](https://supabase.com/dashboard/project/ddoihmeqpjjiumqndjgk/functions/smtp-relay/logs)
3. **Verify DNS**: Use [MXToolbox](https://mxtoolbox.com/) to check MX records
4. **Check User Assignments**: Ensure user has active signature/banner assignments

### Signatures not appearing

- Verify user email in `profiles` table matches sender email
- Check `user_email_assignments` has active assignment for the user
- View edge function logs for "No assignment found" messages

### Duplicates appearing

The function checks for existing signatures/banners before adding them. If duplicates still appear:
- Check if Exchange is forwarding the email multiple times
- Verify transport rule priority is correct
- Review edge function logs for duplicate detection messages

## Security

- Function is public (`verify_jwt = false`) to accept SendGrid webhooks
- Optional relay secret validation available (add `x-relay-secret` header)
- SendGrid validates sender domain through DNS records
- Resend API key is stored securely in Supabase secrets

## Monitoring

View function logs: https://supabase.com/dashboard/project/ddoihmeqpjjiumqndjgk/functions/smtp-relay/logs

Check for:
- `Email processed with signature and banners added`
- `Email sent successfully via Resend`
- Any error messages
