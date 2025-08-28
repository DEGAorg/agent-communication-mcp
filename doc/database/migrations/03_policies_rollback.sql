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

-- Drop the mark_message_as_read function
DROP FUNCTION IF EXISTS mark_message_as_read(UUID);

-- Disable RLS (optional, uncomment if needed)
-- ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE services DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages DISABLE ROW LEVEL SECURITY; 