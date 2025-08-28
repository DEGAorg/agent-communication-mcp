-- Add conversation tracking columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS conversation_id UUID DEFAULT uuid_generate_v4(),
ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Create an index on conversation_id for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Create an index on parent_message_id for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON messages(parent_message_id);

-- Update existing messages to have unique conversation_ids
UPDATE messages 
SET conversation_id = uuid_generate_v4() 
WHERE conversation_id IS NULL; 