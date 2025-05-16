-- Setup auditor agent with fixed UUID for consistency
-- This command should be run by devops to set up the auditor
-- Replace AUDITOR_PUBLIC_KEY_PLACEHOLDER with the actual auditor public key

-- First ensure the auditor doesn't exist
DELETE FROM agents WHERE id = '00000000-0000-0000-0000-000000000000';

-- Add auditor agent
INSERT INTO agents (id, name, public_key, registered_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',  -- Fixed UUID for auditor
  'System Auditor',
  'AUDITOR_PUBLIC_KEY_PLACEHOLDER',  -- Replace with actual key
  NOW()
);

-- Create policy to make auditor read-only
DROP POLICY IF EXISTS auditor_readonly_policy ON agents;
CREATE POLICY auditor_readonly_policy ON agents
  FOR SELECT USING (true);  -- Allow reading auditor info by anyone

-- Create policy to prevent auditor modification
CREATE POLICY auditor_no_modify_policy ON agents
  FOR UPDATE USING (id != '00000000-0000-0000-0000-000000000000');

CREATE POLICY auditor_no_delete_policy ON agents
  FOR DELETE USING (id != '00000000-0000-0000-0000-000000000000'); 