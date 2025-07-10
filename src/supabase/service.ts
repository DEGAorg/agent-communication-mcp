import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, TABLES, Agent, Service, Message, MessageCreate } from './config.js';
import { logger } from '../logger.js';
import { MessageHandler } from './message-handler.js';
import { AuthService } from './auth.js';
import { 
  hasPublicContent,
  hasPrivateContent,
  hasEncryptedContent
} from './message-types.js';
import { ReceivedContentStorage } from '../storage/received-content.js';
import { EncryptionService } from '../encryption/service.js';

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

  /**
   * Get the Supabase client instance
   */
  getSupabaseClient() {
    return supabase;
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
      logger.info('Testing Supabase connection');
      
      const { data, error } = await supabase.from('agents').select('count').limit(1);
      
      if (error) {
        logger.error({
          msg: 'Supabase connection test failed',
          error: error.message,
          details: error.details,
          context: {
            operation: 'connection_test',
            code: error.code,
            hint: error.hint,
            timestamp: new Date().toISOString()
          }
        });
        throw error;
      }

      logger.info('Supabase connection test successful');

      logger.info('Supabase connection initialized successfully');
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize Supabase connection',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          operation: 'initialization',
          state: 'initialization',
          timestamp: new Date().toISOString()
        }
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
          logger.warn('Realtime connection appears to be dead, attempting reconnection');
          await this.reconnectRealtime();
        }
      } catch (error) {
        logger.error({
          msg: 'Error in health check',
          error: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : String(error),
          context: {
            operation: 'health_check',
            timestamp: new Date().toISOString()
          }
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
      logger.info('Reconnection already in progress, skipping');
      return;
    }

    try {
      this.isReconnecting = true;
      logger.info('Starting realtime reconnection');

      // Clean up existing connection
      if (this.messageChannel) {
        await this.messageChannel.unsubscribe();
        this.messageChannel = null;
      }

      // Attempt to reconnect
      await this.setupRealtimeSubscriptions();
      logger.info('Realtime reconnection successful');
    } catch (error) {
      logger.error({
        msg: 'Failed to reconnect realtime subscription',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          operation: 'realtime_reconnect',
          timestamp: new Date().toISOString()
        }
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
    const retryDelay = 1000;
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
                if (payload.eventType === 'INSERT' && payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
                  const message = payload.new as Message;
                  await this.messageHandler!.handleMessage(message);
                }
              } catch (error) {
                logger.error({
                  msg: 'Error processing message',
                  error: error instanceof Error ? error.message : 'Unknown error',
                  details: error instanceof Error ? error.stack : String(error),
                  context: {
                    messageId: payload.new && typeof payload.new === 'object' && 'id' in payload.new ? payload.new.id : 'unknown',
                    timestamp: new Date().toISOString()
                  }
                });
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

        logger.info(`Realtime subscriptions setup completed (attempt ${attempt})`);
        return; // Success, exit the retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Failed to setup realtime subscriptions (attempt ${attempt}/${maxRetries})`);

        if (attempt < maxRetries) {
          logger.info(`Retrying in ${retryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // If we get here, all retries failed
    logger.error({
      msg: 'Failed to setup realtime subscriptions after all retries',
      error: lastError instanceof Error ? lastError.message : 'Unknown error',
      details: lastError instanceof Error ? lastError.stack : String(lastError),
      context: {
        operation: 'realtime_setup',
        maxRetries,
        timestamp: new Date().toISOString()
      }
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
  async listServices(filters?: {
    topics?: string[];
    minPrice?: number;
    maxPrice?: number;
    serviceType?: string;
    includeInactive?: boolean;
  }): Promise<Service[]> {
    try {
      let query = supabase
        .from(TABLES.SERVICES)
        .select('*');

      // By default, only show active services unless explicitly requested
      if (!filters?.includeInactive) {
        query = query.eq('status', 'active');
      }

      // Apply price filters
      if (filters?.minPrice !== undefined && filters.minPrice !== null) {
        query = query.gte('price', filters.minPrice);
      }
      if (filters?.maxPrice !== undefined && filters.maxPrice !== null) {
        query = query.lte('price', filters.maxPrice);
      }

      // Apply service type filter
      if (filters?.serviceType) {
        query = query.eq('type', filters.serviceType);
      }

      // Apply topic filters using text search
      if (filters?.topics && filters.topics.length > 0) {
        // Create a text search query for each topic
        const searchQueries = filters.topics.map(topic => {
          const searchTerm = topic.trim();
          return `or(name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%)`;
        });

        // Combine all search queries
        const searchQuery = searchQueries.join(',');
        
        // Use the search query
        query = query.or(searchQuery);
      }

      const { data, error } = await query;

      if (error) {
        logger.error({
          msg: 'Error listing services',
          error: error.message,
          details: error.details,
          context: {
            filters,
            code: error.code,
            hint: error.hint
          }
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error({
        msg: 'Error listing services',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          filters,
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
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

  async getUnreadMessages(agentId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from(TABLES.MESSAGES)
      .select('*')
      .eq('recipient_agent_id', agentId)
      .eq('read', false)
      .order('created_at', { ascending: true }); // Process oldest messages first

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
      const { data: deliveryMessage, error: deliveryError } = await supabase
        .from('messages')
        .select('*')
        .eq('parent_message_id', parentMessageId)
        .single();

      if (deliveryError) {
        logger.error('Error getting message by parent ID:', deliveryError);
        return null;
      }

      return deliveryMessage;
    } catch (error) {
      logger.error('Error getting message by parent ID:', error);
      return null;
    }
  }

  async checkServiceDelivery(paymentMessageId: string, serviceId: string): Promise<{ status: string; content?: any; version?: string }> {
    try {
      // First check if we have the content in local storage
      const receivedContentStorage = ReceivedContentStorage.getInstance();
      const agentId = this.getCurrentAgentId();
      const localContent = await receivedContentStorage.getContent(agentId, serviceId, paymentMessageId);
      
      if (localContent) {
        return {
          status: 'delivered',
          content: localContent.content,
          version: localContent.version
        };
      }

      // If not in local storage, check for delivery message
      const deliveryMessage = await this.getMessageByParentId(paymentMessageId);
      if (!deliveryMessage) {
        return { status: 'pending' };
      }

      // Get content data from either public or private content
      let contentData: any;
      let version: string | undefined;

      if (hasPublicContent(deliveryMessage)) {
        contentData = deliveryMessage.public.content.data;
        version = deliveryMessage.public.content.metadata.version;
      } else if (hasPrivateContent(deliveryMessage) && hasEncryptedContent(deliveryMessage)) {
        // Get the recipient's private key using EncryptionService
        const encryptionService = new EncryptionService(this.getCurrentAgentId());
        const recipientPrivateKey = encryptionService.getPrivateKey();
        
        // Get sender's public key
        const senderPublicKeyBase64 = await this.getAgentPublicKey(deliveryMessage.sender_agent_id);
        if (!senderPublicKeyBase64) {
          throw new Error(`Sender agent ${deliveryMessage.sender_agent_id} not found or has no public key`);
        }
        const senderPublicKey = Buffer.from(senderPublicKeyBase64, 'base64');

        // Decrypt the content
        const { publicMessage } = await encryptionService.decryptMessageAndCheckType(
          deliveryMessage.private.encryptedMessage!,
          deliveryMessage.private.encryptedKeys!.recipient,
          senderPublicKey,
          recipientPrivateKey
        );

        if (!publicMessage) {
          throw new Error('Failed to decrypt message content');
        }

        contentData = publicMessage.content.data;
        version = publicMessage.content.metadata.version;
      } else {
        throw new Error('Message has no valid content');
      }

      // Store the content locally for future use
      await receivedContentStorage.storeContent({
        payment_message_id: paymentMessageId,
        service_id: serviceId,
        agent_id: this.getCurrentAgentId(),
        content: contentData,
        version
      });

      return {
        status: 'received',
        content: contentData,
        version
      };
    } catch (error) {
      logger.error({
        msg: 'Error checking service delivery',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          paymentMessageId,
          serviceId,
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Supabase service');
      
      // Stop health check
      this.stopHealthCheck();
      
      // Only attempt to update services if we have an authenticated agent
      try {
        const agentId = this.getCurrentAgentId();
        const { error: updateError } = await supabase
          .from(TABLES.SERVICES)
          .update({ 
            status: 'inactive',
            connection_status: 'disconnected'
          })
          .eq('agent_id', agentId)
          .eq('connection_status', 'connected');

        if (updateError) {
          logger.error({
            msg: 'Error marking services as disconnected',
            error: updateError.message,
            details: updateError.details,
            context: {
              operation: 'service_disconnection',
              agentId,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        // Log but don't throw - this is expected during cleanup when not authenticated
        logger.info({
          msg: 'Skipping service status update during cleanup - no authenticated agent',
          context: {
            operation: 'cleanup',
            timestamp: new Date().toISOString()
          }
        });
      }
      
      // Clean up realtime subscriptions
      if (this.messageChannel) {
        try {
          logger.info('Unsubscribing from realtime channel');
          await this.messageChannel.unsubscribe();
          this.messageChannel = null;
          logger.info('Successfully unsubscribed from realtime channel');
        } catch (error) {
          logger.error({
            msg: 'Error unsubscribing from realtime channel',
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : String(error),
            context: {
              operation: 'cleanup',
              timestamp: new Date().toISOString()
            }
          });
          // Don't throw here, try to continue with other cleanup
        }
      }

      // Clear service references
      this.messageHandler = null;
      this.authService = null;

      logger.info('Supabase service cleanup completed');
    } catch (error) {
      logger.error({
        msg: 'Error during Supabase service cleanup',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          operation: 'cleanup',
          timestamp: new Date().toISOString()
        }
      });
      // Don't throw the error during cleanup
      logger.info('Continuing with cleanup despite errors');
    }
  }

  /**
   * Check the connection status of the Supabase service
   * @returns Object containing connection status information
   */
  async checkConnection(): Promise<{ 
    connected: boolean; 
    status: string;
    authenticated: boolean;
    authStatus: string;
  }> {
    try {
      // Test connection by making a simple query
      const { data, error } = await supabase.from('agents').select('count').limit(1);
      
      if (error) {
        logger.error({
          msg: 'Supabase connection check failed',
          error: error.message,
          details: error.details,
          context: {
            operation: 'connection_check',
            code: error.code,
            hint: error.hint,
            timestamp: new Date().toISOString()
          }
        });
        return {
          connected: false,
          status: `Connection error: ${error.message}`,
          authenticated: false,
          authStatus: 'Not authenticated (connection failed)'
        };
      }

      // Check realtime subscription status
      const realtimeStatus = this.messageChannel ? 'connected' : 'disconnected';

      // Check authentication status
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const isAuthenticated = !!sessionData.session;
      const authStatus = isAuthenticated 
        ? `Authenticated as ${sessionData.session.user.email}`
        : 'Not authenticated';

      return {
        connected: true,
        status: `Connected (Realtime: ${realtimeStatus})`,
        authenticated: isAuthenticated,
        authStatus
      };
    } catch (error) {
      logger.error({
        msg: 'Error checking Supabase connection',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          operation: 'connection_check',
          timestamp: new Date().toISOString()
        }
      });
      return {
        connected: false,
        status: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        authenticated: false,
        authStatus: 'Not authenticated (check failed)'
      };
    }
  }
} 