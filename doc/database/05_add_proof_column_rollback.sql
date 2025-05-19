-- Drop proof index
DROP INDEX IF EXISTS idx_messages_proof;

-- Drop proof column
ALTER TABLE messages DROP COLUMN IF EXISTS proof; 