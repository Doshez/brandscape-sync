-- Add RLS policy to allow admins to delete any user profile
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
    AND is_admin = true
  )
);