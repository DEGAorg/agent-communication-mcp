-- First drop all triggers
DROP TRIGGER IF EXISTS service_delivery_trigger ON service_contents;

-- Drop all functions
DROP FUNCTION IF EXISTS handle_service_delivery();
DROP FUNCTION IF EXISTS mark_message_as_read(UUID);

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

-- Drop tables in reverse order of creation to handle foreign key constraints
DROP TABLE IF EXISTS service_contents CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Drop UUID extension
DROP EXTENSION IF EXISTS "uuid-ossp"; 