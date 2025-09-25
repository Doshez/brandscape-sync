-- Update the SELECT policy to allow admins to view all profiles, including admin-created ones
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile or admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (EXISTS ( 
    SELECT 1
    FROM profiles
    WHERE (profiles.user_id = auth.uid() AND profiles.is_admin = true)
  ))
);