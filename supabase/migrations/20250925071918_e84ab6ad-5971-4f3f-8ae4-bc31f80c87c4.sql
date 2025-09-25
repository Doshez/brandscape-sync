-- Drop the foreign key constraint that requires user_id to reference auth.users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Make user_id nullable since admin-created users won't have auth records
ALTER TABLE public.profiles ALTER COLUMN user_id DROP NOT NULL;

-- Add a check to ensure either user_id exists OR it's an admin-created user
-- We'll identify admin-created users by having a null user_id but having email/name
ALTER TABLE public.profiles ADD CONSTRAINT valid_user_profile 
CHECK (
  (user_id IS NOT NULL) OR 
  (user_id IS NULL AND email IS NOT NULL AND first_name IS NOT NULL)
);