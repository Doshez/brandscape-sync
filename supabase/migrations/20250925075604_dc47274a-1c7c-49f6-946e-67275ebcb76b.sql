-- Fix inactive exchange connections that should be active
UPDATE exchange_connections 
SET is_active = true, updated_at = now()
WHERE email = 'michael.odongo@cioafrica.co' AND is_active = false;