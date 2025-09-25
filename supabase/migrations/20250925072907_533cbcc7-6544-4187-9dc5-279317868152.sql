-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Users can view their own profile or admins can view all profiles" ON public.profiles;

-- Create a security definer function to check admin status without triggering RLS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid() 
    AND is_admin = true
  )
$$;

-- Create new policies using the security definer function
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_admin_user());

-- Update other policies to use the security definer function
DROP POLICY IF EXISTS "Users can insert their own profile or admins can insert any pro" ON public.profiles;

CREATE POLICY "Users can insert their own profile or admins can insert any profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK ((auth.uid() = user_id) OR public.is_admin_user());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile or admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING ((auth.uid() = user_id) OR public.is_admin_user())
WITH CHECK ((auth.uid() = user_id) OR public.is_admin_user());