-- Drop indexes
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_messages_parent_message_id;

-- Drop columns
ALTER TABLE messages 
DROP COLUMN IF EXISTS conversation_id,
DROP COLUMN IF EXISTS parent_message_id; 