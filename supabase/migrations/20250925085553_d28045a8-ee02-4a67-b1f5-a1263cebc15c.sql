-- Create deployment history table to track all deployments
CREATE TABLE public.deployment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID REFERENCES auth.users(id),
  target_user_email TEXT NOT NULL,
  signature_id UUID REFERENCES email_signatures(id) ON DELETE SET NULL,
  banner_id UUID REFERENCES banners(id) ON DELETE SET NULL,
  deployment_status TEXT NOT NULL DEFAULT 'pending', -- pending, success, failed
  error_message TEXT,
  deployed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for deployment history
ALTER TABLE public.deployment_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all deployment history
CREATE POLICY "Admins can view all deployment history"
ON public.deployment_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Admins can insert deployment history
CREATE POLICY "Admins can insert deployment history"
ON public.deployment_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_deployment_history_updated_at
BEFORE UPDATE ON public.deployment_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();