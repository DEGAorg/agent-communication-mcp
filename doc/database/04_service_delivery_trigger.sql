-- Create a function to handle service delivery
CREATE OR REPLACE FUNCTION handle_service_delivery()
RETURNS TRIGGER AS $$
DECLARE
  service_record RECORD;
  message_content JSONB;
BEGIN
  -- Get the service details
  SELECT * INTO service_record
  FROM services
  WHERE id = NEW.service_id;

  -- Create the message content
  message_content := jsonb_build_object(
    'topic', 'delivery',
    'serviceId', NEW.service_id,
    'content', jsonb_build_object(
      'type', 'transaction',
      'data', jsonb_build_object(
        'type', 'service_delivery',
        'status', 'completed',
        'service_name', service_record.name,
        'content', NEW.content,
        'version', NEW.version,
        'timestamp', NOW()
      ),
      'metadata', jsonb_build_object(
        'timestamp', NOW(),
        'version', '1.0',
        'extra', jsonb_build_object(
          'purpose', 'service_delivery'
        )
      )
    )
  );

  -- Insert the message
  INSERT INTO messages (
    sender_agent_id,
    recipient_agent_id,
    public,
    private,
    read
  ) VALUES (
    service_record.agent_id,
    NEW.agent_id,
    message_content,
    '{}',
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS service_delivery_trigger ON service_contents;
CREATE TRIGGER service_delivery_trigger
  AFTER INSERT ON service_contents
  FOR EACH ROW
  EXECUTE FUNCTION handle_service_delivery(); 