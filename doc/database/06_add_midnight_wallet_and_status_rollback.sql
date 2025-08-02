-- Remove indexes first
DROP INDEX IF EXISTS idx_services_status;
DROP INDEX IF EXISTS idx_services_midnight_wallet;

-- Remove columns
ALTER TABLE services
DROP COLUMN IF EXISTS midnight_wallet_address,
DROP COLUMN IF EXISTS status; 