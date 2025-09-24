-- Fix infinite recursion in profiles table policies
-- First, check current policies and drop them all
DO $$ 
DECLARE
    pol_name text;
BEGIN
    -- Drop all existing policies on profiles table
    FOR pol_name IN SELECT polname FROM pg_policy pol JOIN pg_class pc ON pol.polrelid = pc.oid WHERE pc.relname = 'profiles'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_name || '" ON public.profiles';
    END LOOP;
END $$;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);