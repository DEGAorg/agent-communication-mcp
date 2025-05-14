import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { Message as MessageType, MessagePublic } from './message-types.js';

// Database types
export interface Agent {
  id: string;
  name: string;
  public_key: string;
  registered_at: string;
}

export interface Service {
  id: string;
  agent_id: string;
  name: string;
  type: string;
  example: string;
  price: number;
  description: string;
}

export interface Message extends MessageType {
  id: string;
  created_at: string;
  read: boolean;
}

// Create Supabase client
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

// Table names
export const TABLES = {
  AGENTS: 'agents',
  SERVICES: 'services',
  MESSAGES: 'messages',
} as const;

// RLS Policies
export const POLICIES = {
  AGENTS: {
    SELECT: 'agents_select_policy',
    INSERT: 'agents_insert_policy',
    UPDATE: 'agents_update_policy',
  },
  SERVICES: {
    SELECT: 'services_select_policy',
    INSERT: 'services_insert_policy',
    UPDATE: 'services_update_policy',
  },
  MESSAGES: {
    SELECT: 'messages_select_policy',
    INSERT: 'messages_insert_policy',
    UPDATE: 'messages_update_policy',
  },
} as const; 