-- Reactivate the Exchange connection since user added MailboxSettings.ReadWrite permission
UPDATE exchange_connections 
SET is_active = true, updated_at = now()
WHERE email = 'michael.odongo@cioafrica.co';