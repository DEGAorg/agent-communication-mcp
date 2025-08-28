-- Add connection_status field to services table
ALTER TABLE services
ADD COLUMN connection_status VARCHAR(20) NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'manual_disabled'));

-- Add index for connection_status field for faster filtering
CREATE INDEX idx_services_connection_status ON services(connection_status);

-- Update existing services to have default connection status
UPDATE services SET connection_status = 'connected' WHERE connection_status IS NULL; 