import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, TABLES, Agent, Service, Message } from './config.js';
import { logger } from '../logger.js';

export class SupabaseService {
  private messageChannel: RealtimeChannel | null = null;

  constructor() {
    this.setupRealtimeSubscriptions();
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const { data, error } = await supabase.from('agents').select('count').limit(1);
      if (error) {
        throw error;
      }
      logger.info('Supabase connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Supabase connection:', error);
      throw error;
    }
  }

  private setupRealtimeSubscriptions() {
    this.messageChannel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.MESSAGES,
        },
        (payload) => {
          logger.info('Message change received:', payload);
          // TODO: Implement message handling logic
        }
      )
      .subscribe();
  }

  // Agent operations
  async registerAgent(agent: Omit<Agent, 'registered_at'>): Promise<Agent> {
    const { data, error } = await supabase
      .from(TABLES.AGENTS)
      .insert([agent])
      .select()
      .single();

    if (error) {
      logger.error('Error registering agent:', error);
      throw error;
    }
    return data;
  }

  async getAgent(id: string): Promise<Agent | null> {
    const { data, error } = await supabase
      .from(TABLES.AGENTS)
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Error getting agent:', error);
      throw error;
    }
    return data;
  }

  // Service operations
  async listServices(): Promise<Service[]> {
    const { data, error } = await supabase
      .from(TABLES.SERVICES)
      .select('*');

    if (error) throw error;
    return data || [];
  }

  async registerService(service: Omit<Service, 'id'>): Promise<Service> {
    const { data, error } = await supabase
      .from(TABLES.SERVICES)
      .insert([service])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getServiceById(serviceId: string): Promise<Service | null> {
    const { data, error } = await supabase
      .from(TABLES.SERVICES)
      .select()
      .eq('id', serviceId)
      .maybeSingle();

    if (error) {
      logger.error('Error getting service:', error);
      throw error;
    }
    return data;
  }

  // Message operations
  async sendMessage(message: Omit<Message, 'id' | 'created_at' | 'read'>): Promise<Message> {
    const { data, error } = await supabase
      .from(TABLES.MESSAGES)
      .insert([{ ...message, read: false }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMessages(agentId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from(TABLES.MESSAGES)
      .select('*')
      .or(`sender_agent_id.eq.${agentId},recipient_agent_id.eq.${agentId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    const { error } = await supabase
      .from(TABLES.MESSAGES)
      .update({ read: true })
      .eq('id', messageId);

    if (error) throw error;
  }

  // Cleanup
  async cleanup() {
    if (this.messageChannel) {
      await this.messageChannel.unsubscribe();
    }
  }
} 