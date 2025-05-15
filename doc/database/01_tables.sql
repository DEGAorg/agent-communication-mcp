-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  public_key TEXT NOT NULL,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create services table
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  example TEXT,
  price NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content_privacy VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (content_privacy IN ('public', 'private', 'mixed')),
  payment_privacy VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (payment_privacy IN ('public', 'private', 'mixed')),
  delivery_privacy VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (delivery_privacy IN ('public', 'private', 'mixed')),
  privacy_conditions JSONB
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  recipient_agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  public JSONB NOT NULL,
  private JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY; 