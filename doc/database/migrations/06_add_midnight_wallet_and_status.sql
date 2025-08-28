-- Add midnight_wallet_address and status fields to services table
ALTER TABLE services
ADD COLUMN midnight_wallet_address VARCHAR(255) NOT NULL,
ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive'));

-- Add index for status field for faster filtering
CREATE INDEX idx_services_status ON services(status);

-- Add index for midnight_wallet_address for faster lookups
CREATE INDEX idx_services_midnight_wallet ON services(midnight_wallet_address);

-- Set all existing services to inactive by default
UPDATE services SET status = 'inactive'; 