-- Drop existing policies with exact names
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile or admins can update any pro" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile or admins can insert any pro" ON public.profiles;

-- Recreate all policies properly
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_admin_user());

CREATE POLICY "Users can insert their own profile or admins can insert any profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK ((auth.uid() = user_id) OR public.is_admin_user());

CREATE POLICY "Users can update their own profile or admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING ((auth.uid() = user_id) OR public.is_admin_user())
WITH CHECK ((auth.uid() = user_id) OR public.is_admin_user());

CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);