-- Drop existing INSERT policy for profiles
DROP POLICY IF EXISTS "Users can insert their own profile or admins can insert any pro" ON public.profiles;

-- Create new INSERT policy that allows admins to insert any profile
CREATE POLICY "Users can insert their own profile or admins can insert any profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id) OR 
  is_admin_user()
);

-- Drop existing UPDATE policy for profiles
DROP POLICY IF EXISTS "Users can update their own profile or admins can update any pro" ON public.profiles;

-- Create new UPDATE policy that allows admins to update any profile
CREATE POLICY "Users can update their own profile or admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id) OR 
  is_admin_user()
)
WITH CHECK (
  (auth.uid() = user_id) OR 
  is_admin_user()
);

-- Update SELECT policy to allow admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = user_id) OR
  is_admin_user()
);