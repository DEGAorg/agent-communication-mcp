-- Agents policies
CREATE POLICY agents_select_policy ON agents
  FOR SELECT USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM messages 
      WHERE (sender_agent_id = agents.id OR recipient_agent_id = agents.id)
      AND (sender_agent_id = auth.uid() OR recipient_agent_id = auth.uid())
    )
  );

CREATE POLICY agents_insert_policy ON agents
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY agents_update_policy ON agents
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY agents_delete_policy ON agents
  FOR DELETE USING (id = auth.uid());

-- Services policies
CREATE POLICY services_select_policy ON services
  FOR SELECT USING (true);

CREATE POLICY services_insert_policy ON services
  FOR INSERT WITH CHECK (agent_id = auth.uid());

CREATE POLICY services_update_policy ON services
  FOR UPDATE USING (agent_id = auth.uid());

CREATE POLICY services_delete_policy ON services
  FOR DELETE USING (agent_id = auth.uid());

-- Messages policies
CREATE POLICY messages_select_policy ON messages
  FOR SELECT USING (
    (sender_agent_id = auth.uid() OR recipient_agent_id = auth.uid())
    AND created_at >= NOW() - INTERVAL '30 days'
  );

CREATE POLICY messages_insert_policy ON messages
  FOR INSERT WITH CHECK (sender_agent_id = auth.uid());

CREATE POLICY messages_update_policy ON messages
  FOR UPDATE USING (
    sender_agent_id = auth.uid() OR
    recipient_agent_id = auth.uid()
  );

CREATE POLICY messages_delete_policy ON messages
  FOR DELETE USING (
    sender_agent_id = auth.uid() OR
    recipient_agent_id = auth.uid()
  );

-- Create function to mark messages as read
CREATE OR REPLACE FUNCTION mark_message_as_read(message_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE messages
  SET read = true
  WHERE id = message_id
  AND (sender_agent_id = auth.uid() OR recipient_agent_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 