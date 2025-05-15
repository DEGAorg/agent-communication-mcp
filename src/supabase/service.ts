import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, TABLES, Agent, Service, Message } from './config.js';
import { logger } from '../logger.js';
import { MessageHandler } from './message-handler.js';
import { AuthService } from './auth.js';

export class SupabaseService {
  private static instance: SupabaseService;
  private messageChannel: RealtimeChannel | null = null;
  private messageHandler: MessageHandler | null = null;
  private authService: AuthService | null = null;

  private constructor() {}

  static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  setAuthService(authService: AuthService) {
    this.authService = authService;
  }

  setMessageHandler(messageHandler: MessageHandler) {
    this.messageHandler = messageHandler;
  }

  private getCurrentAgentId(): string {
    if (!this.authService) {
      throw new Error('AuthService not initialized');
    }
    const agentId = this.authService.getCurrentUserId();
    if (!agentId) {
      throw new Error('No authenticated agent found');
    }
    return agentId;
  }

  async initialize(): Promise<void> {
    try {
      if (!this.authService) {
        throw new Error('AuthService not initialized');
      }
      if (!this.messageHandler) {
        throw new Error('MessageHandler not initialized');
      }

      // Test connection
      logger.info('Testing Supabase connection...');
      const { data, error } = await supabase.from('agents').select('count').limit(1);
      
      if (error) {
        logger.error('Supabase connection test failed:', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      logger.info('Supabase connection test successful', {
        data,
        hasAuth: !!this.authService
      });

      logger.info('Supabase connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Supabase connection:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        state: 'initialization'
      });
      throw error;
    }
  }

  /**
   * Set up realtime subscriptions after authentication is complete
   */
  async setupRealtimeSubscriptions(): Promise<void> {
    try {
      if (!this.messageHandler) {
        throw new Error('MessageHandler not initialized');
      }
      const agentId = this.getCurrentAgentId();
      
      this.messageChannel = supabase
        .channel(`messages:${agentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: TABLES.MESSAGES,
            filter: `recipient_agent_id=eq.${agentId}`,
          },
          async (payload) => {
            logger.info('Message change received:', payload);
            try {
              if (payload.eventType === 'INSERT') {
                const message = payload.new as Message;
                await this.messageHandler!.handleMessage(message);
              }
            } catch (error) {
              logger.error('Error processing message:', error);
            }
          }
        )
        .subscribe();

      logger.info('Realtime subscriptions setup completed');
    } catch (error) {
      logger.error('Failed to setup realtime subscriptions:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });
      throw error;
    }
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