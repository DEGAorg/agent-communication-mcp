# Database Setup Guide

This directory contains the SQL files needed to set up the Supabase database for the Agent Communication MCP server.

## Setup Steps

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Execute the files in the following order:
   - `01_tables.sql` - Creates the database tables
   - `02_indexes.sql` - Creates necessary indexes
   - `03_policies.sql` - Sets up Row Level Security (RLS) policies

## Database Schema

The database consists of three main tables:

1. `agents` - Stores agent information
   - Primary key: `id` (UUID)
   - Contains: name, public key, registration timestamp

2. `services` - Stores service information
   - Primary key: `id` (UUID)
   - Foreign key: `agent_id` references `agents(id)`
   - Contains: name, service ID, type, example, price, description

3. `messages` - Stores encrypted messages
   - Primary key: `id` (UUID)
   - Foreign keys: `sender_agent_id` and `recipient_agent_id` reference `agents(id)`
   - Contains: public and private message data, timestamps, read status

## Security

All tables have Row Level Security (RLS) enabled with the following policies:

- `agents`: Public read, authenticated write
- `services`: Public read, owner write
- `messages`: Sender/recipient read/write only

## Maintenance

To reset the database:
1. Drop all tables in reverse order
2. Re-run the SQL files in order

To backup the database:
1. Use Supabase's built-in backup functionality
2. Export the data using the Supabase dashboard 