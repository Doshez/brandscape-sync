-- Reset password for michael.odongo@cioafrica.co using proper Supabase auth methods
-- We need to update the encrypted password using the correct format

UPDATE auth.users 
SET 
  encrypted_password = crypt('1993Wepesi#$', gen_salt('bf')),
  updated_at = now()
WHERE email = 'michael.odongo@cioafrica.co';