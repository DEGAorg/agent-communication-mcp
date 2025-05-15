-- Drop the trigger
DROP TRIGGER IF EXISTS payment_notification_trigger ON messages;

-- Drop the function
DROP FUNCTION IF EXISTS handle_payment_notification(); 