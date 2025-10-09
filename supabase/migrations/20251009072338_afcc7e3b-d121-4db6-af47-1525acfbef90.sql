-- Fix security warning: Add search_path to function
DROP FUNCTION IF EXISTS generate_tracking_id();

CREATE OR REPLACE FUNCTION generate_tracking_id()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql
SET search_path TO 'public';