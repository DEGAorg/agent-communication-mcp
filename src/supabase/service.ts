import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, TABLES, Agent, Service, Message, MessageCreate } from './config.js';
import { logger } from '../logger.js';
import { MessageHandler } from './message-handler.js';
import { AuthService } from './auth.js';
import { createClient } from '@supabase/supabase-js';
import { TRANSACTION_TYPES } from './message-types.js';

export class SupabaseService {
  private static instance: SupabaseService;
  private messageChannel: RealtimeChannel | null = null;
  private messageHandler: MessageHandler | null = null;
  private authService: AuthService | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly MAX_MISSED_HEARTBEATS = 2;
  private isReconnecting: boolean = false;

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
   * Start health check monitoring for realtime connection
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.lastHeartbeat = Date.now();
    this.healthCheckInterval = setInterval(async () => {
      try {
        const now = Date.now();
        const timeSinceLastHeartbeat = now - this.lastHeartbeat;
        
        if (timeSinceLastHeartbeat > this.HEARTBEAT_INTERVAL * this.MAX_MISSED_HEARTBEATS) {
          logger.warn('Realtime connection appears to be dead, attempting reconnection...', {
            timeSinceLastHeartbeat,
            maxAllowed: this.HEARTBEAT_INTERVAL * this.MAX_MISSED_HEARTBEATS
          });
          await this.reconnectRealtime();
        }
      } catch (error) {
        logger.error('Error in health check:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error
        });
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Attempt to reconnect the realtime subscription
   */
  private async reconnectRealtime(): Promise<void> {
    if (this.isReconnecting) {
      logger.info('Reconnection already in progress, skipping...');
      return;
    }

    try {
      this.isReconnecting = true;
      logger.info('Starting realtime reconnection...');

      // Clean up existing connection
      if (this.messageChannel) {
        await this.messageChannel.unsubscribe();
        this.messageChannel = null;
      }

      // Attempt to reconnect
      await this.setupRealtimeSubscriptions();
      logger.info('Realtime reconnection successful');
    } catch (error) {
      logger.error('Failed to reconnect realtime subscription:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });
      throw error;
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Set up realtime subscriptions after authentication is complete
   */
  async setupRealtimeSubscriptions(): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.messageHandler) {
          throw new Error('MessageHandler not initialized');
        }
        const agentId = this.getCurrentAgentId();
        
        // If we have an existing channel, unsubscribe first
        if (this.messageChannel) {
          await this.messageChannel.unsubscribe();
          this.messageChannel = null;
        }
        
        this.messageChannel = supabase
          .channel(`table_db_changes`)
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
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              logger.info('Successfully subscribed to realtime channel');
              this.lastHeartbeat = Date.now();
              this.startHealthCheck();
            } else if (status === 'CLOSED') {
              logger.warn('Realtime channel closed');
              this.stopHealthCheck();
            } else if (status === 'CHANNEL_ERROR') {
              logger.error('Realtime channel error');
              this.stopHealthCheck();
            }
          });

        logger.info('Realtime subscriptions setup completed');
        return; // Success, exit the retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Failed to setup realtime subscriptions (attempt ${attempt}/${maxRetries}):`, {
          error: lastError.message,
          attempt,
          maxRetries
        });

        if (attempt < maxRetries) {
          logger.info(`Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // If we get here, all retries failed
    logger.error('Failed to setup realtime subscriptions after all retries:', {
      error: lastError instanceof Error ? {
        name: lastError.name,
        message: lastError.message,
        stack: lastError.stack
      } : lastError
    });
    throw lastError;
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

  async getAgentPublicKey(id: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('agent_public_keys')
      .select('public_key')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Error getting agent public key:', error);
      throw error;
    }
    return data?.public_key || null;
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
  async sendMessage(message: MessageCreate): Promise<Message> {
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

  async getMessageById(messageId: string): Promise<Message | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (error) {
        logger.error('Error getting message by ID:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error getting message by ID:', error);
      return null;
    }
  }

  async getMessageByParentId(parentMessageId: string): Promise<Message | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('parent_message_id', parentMessageId)
        .eq('public->content->data->type', TRANSACTION_TYPES.SERVICE_DELIVERY)
        .single();

      if (error) {
        logger.error('Error getting message by parent ID:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error getting message by parent ID:', error);
      return null;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Supabase service...');
      
      // Stop health check
      this.stopHealthCheck();
      
      // Clean up realtime subscriptions
      if (this.messageChannel) {
        try {
          logger.info('Unsubscribing from realtime channel...');
          await this.messageChannel.unsubscribe();
          this.messageChannel = null;
          logger.info('Successfully unsubscribed from realtime channel');
        } catch (error) {
          logger.error('Error unsubscribing from realtime channel:', {
            error: error instanceof Error ? {
              name: error.name,
              message: error.message,
              stack: error.stack
            } : error
          });
          // Don't throw here, try to continue with other cleanup
        }
      }

      // Clear service references
      this.messageHandler = null;
      this.authService = null;

      logger.info('Supabase service cleanup completed');
    } catch (error) {
      logger.error('Error during Supabase service cleanup:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      });
      throw error;
    }
  }
} 