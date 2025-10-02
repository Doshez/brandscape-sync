-- Clean up orphaned user_banner_assignments
-- These are banner assignments for user_email_assignments that no longer exist

-- Delete orphaned banner assignments
DELETE FROM user_banner_assignments
WHERE user_assignment_id NOT IN (
  SELECT id FROM user_email_assignments WHERE is_active = true
);