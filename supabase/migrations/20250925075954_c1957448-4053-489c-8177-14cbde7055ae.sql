-- Mark current Exchange connections as inactive to force re-authentication with proper permissions
UPDATE exchange_connections 
SET is_active = false, 
    updated_at = now()
WHERE email = 'michael.odongo@cioafrica.co';