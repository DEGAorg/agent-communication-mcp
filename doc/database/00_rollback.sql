-- Drop all policies
DROP POLICY IF EXISTS agents_select_policy ON agents;
DROP POLICY IF EXISTS agents_insert_policy ON agents;
DROP POLICY IF EXISTS agents_update_policy ON agents;
DROP POLICY IF EXISTS agents_delete_policy ON agents;

DROP POLICY IF EXISTS services_select_policy ON services;
DROP POLICY IF EXISTS services_insert_policy ON services;
DROP POLICY IF EXISTS services_update_policy ON services;
DROP POLICY IF EXISTS services_delete_policy ON services;

DROP POLICY IF EXISTS messages_select_policy ON messages;
DROP POLICY IF EXISTS messages_insert_policy ON messages;
DROP POLICY IF EXISTS messages_update_policy ON messages;
DROP POLICY IF EXISTS messages_delete_policy ON messages;

-- Drop tables in reverse order
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS agents;

-- Drop extensions
DROP EXTENSION IF EXISTS "uuid-ossp";

-- Rollback messages table changes
ALTER TABLE messages DROP COLUMN IF EXISTS conversation_id;
ALTER TABLE messages DROP COLUMN IF EXISTS parent_message_id; 