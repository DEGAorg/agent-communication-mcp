-- Drop the trigger
DROP TRIGGER IF EXISTS service_delivery_trigger ON service_contents;

-- Drop the function
DROP FUNCTION IF EXISTS handle_service_delivery(); 