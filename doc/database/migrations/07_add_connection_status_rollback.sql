-- Remove index first
DROP INDEX IF EXISTS idx_services_connection_status;

-- Remove column
ALTER TABLE services
DROP COLUMN IF EXISTS connection_status; 