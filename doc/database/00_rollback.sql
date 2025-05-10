-- First drop all policies
DROP POLICY IF EXISTS agents_select_policy ON agents;
DROP POLICY IF EXISTS services_select_policy ON services;
DROP POLICY IF EXISTS messages_select_policy ON messages;
DROP POLICY IF EXISTS messages_insert_policy ON messages;

-- Drop tables in reverse order of creation to handle foreign key constraints
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS agents CASCADE;

-- Drop UUID extension
DROP EXTENSION IF EXISTS "uuid-ossp"; 