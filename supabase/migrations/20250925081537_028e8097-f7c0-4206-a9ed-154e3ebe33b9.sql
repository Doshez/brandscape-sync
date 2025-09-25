-- Update the email signature to be assigned to your user
UPDATE email_signatures 
SET user_id = (SELECT user_id FROM profiles WHERE email = 'michael.odongo@cioafrica.co' LIMIT 1)
WHERE template_name = 'Default Admin Signature';

-- Make sure banner has target_departments that will match
UPDATE banners 
SET target_departments = ARRAY['IT', 'general']
WHERE name = 'CIO100';