-- Create table for email tracking sessions to map unique IDs to sender + recipient
CREATE TABLE public.email_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  banner_id UUID REFERENCES public.banners(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '90 days'),
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  click_count INTEGER DEFAULT 0
);

-- Index for fast tracking_id lookups
CREATE INDEX idx_tracking_sessions_tracking_id ON public.email_tracking_sessions(tracking_id);

-- Index for banner analytics
CREATE INDEX idx_tracking_sessions_banner_id ON public.email_tracking_sessions(banner_id);

-- Enable RLS
ALTER TABLE public.email_tracking_sessions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all tracking sessions
CREATE POLICY "Admins can manage tracking sessions"
  ON public.email_tracking_sessions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Anyone can insert tracking sessions (for edge function)
CREATE POLICY "Anyone can insert tracking sessions"
  ON public.email_tracking_sessions
  FOR INSERT
  WITH CHECK (true);

-- Function to generate unique tracking ID
CREATE OR REPLACE FUNCTION generate_tracking_id()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;