-- Create the auth user for michael.odongo@cioafrica.co
-- Note: This is a direct insert into auth.users which requires special handling

-- First, let's check if there's an existing auth user
-- We'll use a function to create the user properly

DO $$
BEGIN
  -- Insert user into auth.users if not exists
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    confirmation_token,
    recovery_sent_at,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at
  )
  SELECT 
    '00000000-0000-0000-0000-000000000000',
    'e237053d-55c3-4267-94ad-490ec63210cd'::uuid,
    'authenticated',
    'authenticated',
    'michael.odongo@cioafrica.co',
    crypt('1993Wepesi#$', gen_salt('bf')),
    now(),
    now(),
    '',
    null,
    '',
    '',
    '',
    null,
    null,
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"michael","last_name":"Odongo"}',
    false,
    now(),
    now(),
    null,
    null,
    '',
    '',
    null,
    '',
    0,
    null,
    '',
    null
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'michael.odongo@cioafrica.co'
  );

  -- Ensure the profile exists and is linked correctly
  UPDATE profiles 
  SET user_id = 'e237053d-55c3-4267-94ad-490ec63210cd'::uuid,
      is_admin = true
  WHERE email = 'michael.odongo@cioafrica.co';
  
END $$;