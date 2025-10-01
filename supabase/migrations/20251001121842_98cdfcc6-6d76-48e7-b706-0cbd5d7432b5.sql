-- Add smart host configuration columns to smtp_relay_config table
ALTER TABLE smtp_relay_config
ADD COLUMN IF NOT EXISTS smart_host TEXT DEFAULT 'smtp.sendgrid.net',
ADD COLUMN IF NOT EXISTS smart_host_port TEXT DEFAULT '587',
ADD COLUMN IF NOT EXISTS smart_host_username TEXT DEFAULT 'apikey',
ADD COLUMN IF NOT EXISTS smart_host_type TEXT DEFAULT 'sendgrid';

-- Add comment for documentation
COMMENT ON COLUMN smtp_relay_config.smart_host IS 'SMTP server address for outbound email routing';
COMMENT ON COLUMN smtp_relay_config.smart_host_port IS 'SMTP server port (typically 587 for TLS or 465 for SSL)';
COMMENT ON COLUMN smtp_relay_config.smart_host_username IS 'Username for SMTP authentication';
COMMENT ON COLUMN smtp_relay_config.smart_host_type IS 'Type of smart host configuration (sendgrid, resend, custom)';