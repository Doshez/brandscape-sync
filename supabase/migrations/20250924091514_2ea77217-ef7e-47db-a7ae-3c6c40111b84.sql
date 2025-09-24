-- Create storage bucket for banner and signature images
INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true);

-- Create RLS policies for email assets storage
CREATE POLICY "Anyone can view email assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'email-assets');

CREATE POLICY "Admins can upload email assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'email-assets' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can update email assets" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'email-assets' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can delete email assets" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'email-assets' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);

-- Add permanent Exchange integration table
CREATE TABLE public.exchange_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  microsoft_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, microsoft_user_id)
);

-- Enable RLS on exchange_connections
ALTER TABLE public.exchange_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for exchange_connections
CREATE POLICY "Users can view their own connections" 
ON public.exchange_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own connections" 
ON public.exchange_connections 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all connections" 
ON public.exchange_connections 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
));

-- Add trigger to update updated_at
CREATE TRIGGER update_exchange_connections_updated_at
BEFORE UPDATE ON public.exchange_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enhance banners table with additional fields for better management
ALTER TABLE public.banners 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_clicks INTEGER,
ADD COLUMN IF NOT EXISTS current_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_audience JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS device_targeting TEXT[] DEFAULT ARRAY['desktop', 'mobile'],
ADD COLUMN IF NOT EXISTS geo_targeting TEXT[];

-- Create function to increment banner clicks
CREATE OR REPLACE FUNCTION public.increment_banner_clicks(banner_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE banners 
  SET current_clicks = COALESCE(current_clicks, 0) + 1,
      updated_at = now()
  WHERE id = banner_uuid;
END;
$$;

-- Enhanced analytics_events table indexes for better performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_banner_id ON analytics_events(banner_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);

-- Create view for banner analytics with proper type casting
CREATE OR REPLACE VIEW public.banner_analytics AS
SELECT 
  b.id,
  b.name,
  b.is_active,
  b.created_at,
  b.current_clicks,
  b.max_clicks,
  COUNT(ae.id) as total_events,
  COUNT(CASE WHEN ae.event_type = 'click' THEN 1 END) as click_count,
  COUNT(CASE WHEN ae.event_type = 'impression' THEN 1 END) as impression_count,
  CAST(
    CASE 
      WHEN COUNT(CASE WHEN ae.event_type = 'impression' THEN 1 END) > 0 
      THEN ROUND((COUNT(CASE WHEN ae.event_type = 'click' THEN 1 END)::numeric / COUNT(CASE WHEN ae.event_type = 'impression' THEN 1 END)::numeric) * 100, 2)
      ELSE 0 
    END AS DECIMAL(5,2)
  ) as click_through_rate
FROM banners b
LEFT JOIN analytics_events ae ON b.id = ae.banner_id
GROUP BY b.id, b.name, b.is_active, b.created_at, b.current_clicks, b.max_clicks;

-- Grant access to the view
GRANT SELECT ON public.banner_analytics TO authenticated;