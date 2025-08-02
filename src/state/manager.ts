import { logger } from '../logger.js';
import { AuthService } from '../supabase/auth.js';
import { SupabaseService } from '../supabase/service.js';
import { EncryptionService } from '../encryption/service.js';
import { MessageHandler } from '../supabase/message-handler.js';
import { ReceivedContentStorage } from '../storage/received-content.js';
import { config } from '../config.js';
import { AppError } from '../errors/AppError.js';

export enum SystemState {
  UNINITIALIZED = 'UNINITIALIZED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  AUTHENTICATING = 'AUTHENTICATING',
  AUTHENTICATED = 'AUTHENTICATED',
  REGISTERING = 'REGISTERING',
  REGISTERED = 'REGISTERED',
  READY = 'READY',
  ERROR = 'ERROR'
}

export class StateManager {
  private static instance: StateManager;
  private currentState: SystemState = SystemState.UNINITIALIZED;
  private error: Error | null = null;
  private readonly authService: AuthService;
  private readonly supabaseService: SupabaseService;
  private readonly encryptionService: EncryptionService;
  private readonly messageHandler: MessageHandler;
  private readonly receivedContentStorage: ReceivedContentStorage;

  private constructor(
    authService: AuthService,
    supabaseService: SupabaseService,
    encryptionService: EncryptionService,
    messageHandler: MessageHandler,
    receivedContentStorage: ReceivedContentStorage
  ) {
    this.authService = authService;
    this.supabaseService = supabaseService;
    this.encryptionService = encryptionService;
    this.messageHandler = messageHandler;
    this.receivedContentStorage = receivedContentStorage;
  }

  static async getInstance(): Promise<StateManager> {
    if (!StateManager.instance) {
      // Create service instances
      const authService = AuthService.getInstance();
      const supabaseService = SupabaseService.getInstance();
      const messageHandler = MessageHandler.getInstance();
      
      // Initialize KeyManager with the correct path
      const { KeyManager } = await import('../utils/key-manager.js');
      KeyManager.initialize('.storage');
      
      const encryptionService = new EncryptionService(config.agentId);
      const receivedContentStorage = ReceivedContentStorage.getInstance();

      // Create the instance first
      StateManager.instance = new StateManager(
        authService,
        supabaseService,
        encryptionService,
        messageHandler,
        receivedContentStorage
      );

      // Set up dependencies after instance creation
      authService.setSupabaseService(supabaseService);
      supabaseService.setAuthService(authService);
      supabaseService.setMessageHandler(messageHandler);
      messageHandler.setAuthService(authService);
      messageHandler.setStateManager(StateManager.instance);
      messageHandler.setEncryptionService(encryptionService);
      messageHandler.setSupabaseService(supabaseService);
      messageHandler.setReceivedContentStorage(receivedContentStorage);
    }
    return StateManager.instance;
  }

  getState(): SystemState {
    return this.currentState;
  }

  getError(): Error | null {
    return this.error;
  }

  getAuthService(): AuthService {
    return this.authService;
  }

  getSupabaseService(): SupabaseService {
    return this.supabaseService;
  }

  getEncryptionService(): EncryptionService {
    return this.encryptionService;
  }

  getMessageHandler(): MessageHandler {
    return this.messageHandler;
  }

  getReceivedContentStorage(): ReceivedContentStorage {
    return this.receivedContentStorage;
  }

  private setState(newState: SystemState, error: Error | null = null) {
    const previousState = this.currentState;
    this.currentState = newState;
    this.error = error;
    
    if (error) {
      logger.error({
        msg: 'System state changed with error',
        error: error.message,
        details: error.stack,
        context: {
          previousState,
          newState,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      logger.info(`System state changed: ${previousState} -> ${newState}`);
    }
  }

  private async processUnreadMessages(): Promise<void> {
    const agentId = this.authService.getCurrentUserId();
    if (!agentId) {
      throw new AppError(
        'No authenticated agent found',
        'AUTH_REQUIRED',
        401
      );
    }

    // Get all unread messages for this agent
    const messages = await this.supabaseService.getUnreadMessages(agentId);
    
    if (messages.length > 0) {
      logger.info(`Processing ${messages.length} unread messages`);
      
      // Process each message sequentially to maintain order
      for (const message of messages) {
        try {
          await this.messageHandler.handleMessage(message);
        } catch (error) {
          logger.error({
            msg: `Error processing unread message ${message.id}`,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : String(error),
            context: {
              messageId: message.id,
              timestamp: new Date().toISOString()
            }
          });
          // Continue processing other messages even if one fails
        }
      }
      
      logger.info('Finished processing unread messages');
    }
  }

  async initialize(): Promise<void> {
    try {
      // Start connection process
      this.setState(SystemState.CONNECTING);
      await this.supabaseService.initialize();
      this.setState(SystemState.CONNECTED);

      // Initialize auth service
      await this.authService.initialize();

      // Check if we have an existing session
      const session = await this.authService.getSession();
      
      if (session) {
        // We have a valid session, proceed with initialization
        this.setState(SystemState.AUTHENTICATED);

        // Set up realtime subscriptions after authentication
        await this.supabaseService.setupRealtimeSubscriptions();

        // Check agent registration
        this.setState(SystemState.REGISTERING);
        const agentId = this.authService.getCurrentUserId();
        if (!agentId) {
          throw new AppError(
            'No authenticated agent found',
            'AUTH_REQUIRED',
            401
          );
        }

        // Verify agent is registered
        const agent = await this.supabaseService.getAgent(agentId);
        if (!agent) {
          throw new AppError(
            'Agent registration failed - please check logs for details',
            'AGENT_REGISTRATION_FAILED',
            500
          );
        }
        
        this.setState(SystemState.REGISTERED);

        // System is ready
        this.setState(SystemState.READY);
        logger.info('All services initialized successfully');

        // Process any unread messages that arrived while offline
        try {
          await this.processUnreadMessages();
        } catch (error) {
          logger.error({
            msg: 'Failed to process unread messages',
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : String(error),
            context: {
              operation: 'unread_messages',
              state: this.currentState,
              timestamp: new Date().toISOString()
            }
          });
          // Don't throw here - we want to continue initialization even if message processing fails
        }
      } else {
        // No valid session, system is ready but needs authentication
        this.setState(SystemState.READY);
        logger.info('System initialized but requires authentication');
      }
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize system',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          operation: 'system_initialization',
          state: this.currentState,
          hasAuth: !!this.authService,
          hasSupabase: !!this.supabaseService,
          hasEncryption: !!this.encryptionService,
          timestamp: new Date().toISOString()
        }
      });
      
      this.setState(SystemState.ERROR, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  isReady(): boolean {
    return this.currentState === SystemState.READY;
  }

  private getStateRequirements(): string[] {
    const requirements: string[] = [];
    
    switch (this.currentState) {
      case SystemState.UNINITIALIZED:
        requirements.push('System needs to be initialized');
        break;
      case SystemState.CONNECTING:
        requirements.push('Database connection in progress');
        break;
      case SystemState.CONNECTED:
        requirements.push('Authentication required');
        break;
      case SystemState.AUTHENTICATING:
        requirements.push('Authentication in progress');
        break;
      case SystemState.AUTHENTICATED:
        requirements.push('Agent registration required');
        break;
      case SystemState.REGISTERING:
        requirements.push('Agent registration in progress');
        break;
      case SystemState.REGISTERED:
        requirements.push('Final initialization required');
        break;
      case SystemState.ERROR:
        requirements.push(`System error: ${this.error?.message || 'Unknown error'}`);
        break;
    }
    
    return requirements;
  }

  async ensureReady(): Promise<void> {
    if (!this.isReady()) {
      const requirements = this.getStateRequirements();
      throw new AppError(
        `System not ready. Current state: ${this.currentState}\nMissing requirements:\n${requirements.map(req => `- ${req}`).join('\n')}`,
        'SYSTEM_NOT_READY',
        503
      );
    }
  }

  async attemptRecovery(): Promise<void> {
    if (this.currentState === SystemState.ERROR) {
      logger.info('Attempting to recover from error state');
      try {
        await this.initialize();
      } catch (error) {
        logger.error({
          msg: 'Recovery failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : String(error),
          context: {
            operation: 'system_recovery',
            state: this.currentState,
            timestamp: new Date().toISOString()
          }
        });
        throw error;
      }
    }
  }

  async ensureReadyWithRecovery(): Promise<void> {
    try {
      await this.ensureReady();
    } catch (error) {
      // If we're in an error state, try to recover
      if (this.currentState === SystemState.ERROR) {
        await this.attemptRecovery();
        // Check if recovery was successful
        await this.ensureReady();
      } else {
        throw error;
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.supabaseService) {
        await this.supabaseService.cleanup();
      }
      this.setState(SystemState.UNINITIALIZED);
    } catch (error) {
      this.setState(SystemState.ERROR, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
} 