-- Create email_configurations table to store DNS and transport rule configurations
CREATE TABLE public.email_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  rule_name TEXT NOT NULL,  
  signature_html TEXT,
  powershell_script TEXT,
  dns_records JSONB,
  target_users TEXT[],
  selected_signature_id UUID,
  selected_banner_id UUID,
  target_user_ids UUID[],
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all email configurations" 
ON public.email_configurations 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create trigger for updating updated_at
CREATE TRIGGER update_email_configurations_updated_at
BEFORE UPDATE ON public.email_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create user_assignments table to track signature and banner assignments
CREATE TABLE public.user_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  configuration_id UUID NOT NULL REFERENCES public.email_configurations(id) ON DELETE CASCADE,
  signature_id UUID REFERENCES public.email_signatures(id) ON DELETE SET NULL,
  banner_id UUID REFERENCES public.banners(id) ON DELETE SET NULL,
  assigned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, configuration_id)
);

-- Enable RLS
ALTER TABLE public.user_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for user_assignments
CREATE POLICY "Users can view their own assignments" 
ON public.user_assignments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all assignments" 
ON public.user_assignments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Create trigger for updating updated_at
CREATE TRIGGER update_user_assignments_updated_at
BEFORE UPDATE ON public.user_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();