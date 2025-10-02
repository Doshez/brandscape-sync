-- Clean up orphaned user_email_assignments with missing profiles
-- These are assignments for users whose profiles don't exist or are mismatched

-- Delete assignments for user_id e237053d-55c3-4267-94ad-490ec63210cd (no matching profile)
DELETE FROM user_email_assignments 
WHERE user_id = 'e237053d-55c3-4267-94ad-490ec63210cd';

-- Delete assignments for user_id 72d1f6ae-523d-444c-aee6-a71859fd5f44 (deleted profile)
DELETE FROM user_email_assignments 
WHERE user_id = '72d1f6ae-523d-444c-aee6-a71859fd5f44';