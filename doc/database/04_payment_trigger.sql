-- Create a function to handle payment notifications
CREATE OR REPLACE FUNCTION handle_payment_notification()
RETURNS TRIGGER AS $$
DECLARE
  service_record RECORD;
  message_content JSONB;
BEGIN
  -- Only process payment notifications
  IF NEW.public->>'topic' != 'payment' THEN
    RETURN NEW;
  END IF;

  -- Get the service details
  SELECT * INTO service_record
  FROM services
  WHERE id = (NEW.public->>'serviceId')::uuid;

  -- Create the delivery message content
  message_content := jsonb_build_object(
    'topic', 'delivery',
    'serviceId', service_record.id,
    'content', jsonb_build_object(
      'type', 'transaction',
      'data', jsonb_build_object(
        'type', 'service_delivery',
        'status', 'completed',
        'service_name', service_record.name,
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

  -- Insert the delivery message
  INSERT INTO messages (
    sender_agent_id,
    recipient_agent_id,
    public,
    private,
    read
  ) VALUES (
    service_record.agent_id,
    NEW.sender_agent_id,
    message_content,
    '{}',
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS payment_notification_trigger ON messages;
CREATE TRIGGER payment_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_notification(); 