-- Drop the existing INSERT policy for profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create a new INSERT policy that allows both self-insertion and admin insertion
CREATE POLICY "Users can insert their own profile or admins can insert any profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) OR 
  (EXISTS ( 
    SELECT 1
    FROM profiles
    WHERE (profiles.user_id = auth.uid() AND profiles.is_admin = true)
  ))
);