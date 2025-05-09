-- Create indexes for better query performance

-- Services indexes
CREATE INDEX idx_services_agent_id ON services(agent_id);
CREATE INDEX idx_services_type ON services(type);

-- Messages indexes
CREATE INDEX idx_messages_sender ON messages(sender_agent_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_agent_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_read ON messages(read);

-- Agents indexes
CREATE INDEX idx_agents_public_key ON agents(public_key);
CREATE INDEX idx_agents_registered_at ON agents(registered_at); 