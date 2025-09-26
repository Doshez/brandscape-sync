-- Create table for user email assignments (signature and banner assignments)
CREATE TABLE public.user_email_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  signature_id UUID REFERENCES public.email_signatures(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, is_active) -- Only one active assignment per user
);

-- Create table for user banner assignments (many-to-many relationship)
CREATE TABLE public.user_banner_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_assignment_id UUID NOT NULL REFERENCES public.user_email_assignments(id) ON DELETE CASCADE,
  banner_id UUID NOT NULL REFERENCES public.banners(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_assignment_id, banner_id)
);

-- Create table for SMTP relay configuration
CREATE TABLE public.smtp_relay_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  relay_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_email_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_banner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_relay_config ENABLE ROW LEVEL SECURITY;

-- Create policies for user_email_assignments
CREATE POLICY "Admins can manage all user email assignments" 
ON public.user_email_assignments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "Users can view their own email assignments" 
ON public.user_email_assignments 
FOR SELECT 
USING (user_id = auth.uid());

-- Create policies for user_banner_assignments
CREATE POLICY "Admins can manage all user banner assignments" 
ON public.user_banner_assignments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "Users can view their own banner assignments through user_assignment" 
ON public.user_banner_assignments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_email_assignments uea
    WHERE uea.id = user_assignment_id AND uea.user_id = auth.uid()
  )
);

-- Create policies for smtp_relay_config (admin only)
CREATE POLICY "Only admins can manage SMTP relay config" 
ON public.smtp_relay_config 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_email_assignments_updated_at
  BEFORE UPDATE ON public.user_email_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_smtp_relay_config_updated_at
  BEFORE UPDATE ON public.smtp_relay_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_user_email_assignments_user_id ON public.user_email_assignments(user_id);
CREATE INDEX idx_user_email_assignments_active ON public.user_email_assignments(is_active);
CREATE INDEX idx_user_banner_assignments_user_assignment_id ON public.user_banner_assignments(user_assignment_id);
CREATE INDEX idx_smtp_relay_config_domain ON public.smtp_relay_config(domain);