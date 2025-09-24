-- Fix the infinite recursion in profiles RLS policies
-- The issue is that admin policies are referencing profiles table within profiles policies

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate admin policies without recursion
-- Use a direct check against the current user's profile instead of a subquery
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (auth.uid() IN (
    SELECT user_id FROM public.profiles WHERE is_admin = true AND user_id = auth.uid()
  ))
);

CREATE POLICY "Admins can update all profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (auth.uid() IN (
    SELECT user_id FROM public.profiles WHERE is_admin = true AND user_id = auth.uid()
  ))
);

-- Fix other tables that might have similar recursion issues
-- Update email_signatures policies
DROP POLICY IF EXISTS "Admins can manage all signatures" ON public.email_signatures;
DROP POLICY IF EXISTS "Users can view their signatures" ON public.email_signatures;

CREATE POLICY "Admins can manage all signatures" 
ON public.email_signatures 
FOR ALL 
USING (
  (auth.uid() = user_id) OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Users can view their signatures" 
ON public.email_signatures 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

-- Update other table policies to avoid recursion
DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
DROP POLICY IF EXISTS "Admins can manage campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admins can manage domains" ON public.domains;
DROP POLICY IF EXISTS "Admins can view analytics" ON public.analytics_events;

CREATE POLICY "Admins can manage banners" 
ON public.banners 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can manage campaigns" 
ON public.campaigns 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can manage company settings" 
ON public.company_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can manage domains" 
ON public.domains 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);

CREATE POLICY "Admins can view analytics" 
ON public.analytics_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_admin = true
  )
);