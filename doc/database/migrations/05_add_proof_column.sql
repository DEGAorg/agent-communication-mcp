-- Add proof column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS proof JSONB;

-- Create an index on proof for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_proof ON messages USING GIN (proof); 