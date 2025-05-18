import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { Message as MessageType, ServicePrivacySettings, MessageCreate } from './message-types.js';
import { logger } from '../logger.js';

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
  example?: string;
  price: number;
  description: string;
  privacy_settings: ServicePrivacySettings;
}

export type Message = MessageType;
export type { MessageCreate };

// Table names
export const TABLES = {
  AGENTS: 'agents',
  SERVICES: 'services',
  MESSAGES: 'messages',
} as const;

// Validate Supabase configuration
if (!config.supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is required');
}
if (!config.supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}

// Log Supabase configuration (without sensitive data)
logger.info('Initializing Supabase client', {
  url: config.supabaseUrl,
  hasAnonKey: !!config.supabaseAnonKey,
  nodeEnv: config.nodeEnv
});

// Create Supabase client
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

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