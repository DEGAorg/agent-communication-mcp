import { logger } from '../logger.js';
import { AuthService } from '../supabase/auth.js';
import { SupabaseService } from '../supabase/service.js';
import { EncryptionService } from '../encryption/service.js';
import { MessageHandler } from '../supabase/message-handler.js';
import { ReceivedContentStorage } from '../storage/received-content.js';

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
  private authService: AuthService | null = null;
  private supabaseService: SupabaseService | null = null;
  private encryptionService: EncryptionService | null = null;
  private messageHandler: MessageHandler | null = null;
  private receivedContentStorage: ReceivedContentStorage | null = null;

  private constructor() {}

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * Initialize all services and set up dependencies
   */
  async initializeServices(): Promise<void> {
    try {
      // Create service instances
      this.authService = AuthService.getInstance();
      this.supabaseService = SupabaseService.getInstance();
      this.messageHandler = MessageHandler.getInstance();
      this.encryptionService = new EncryptionService();
      this.receivedContentStorage = ReceivedContentStorage.getInstance();

      // Set up dependencies
      this.authService.setSupabaseService(this.supabaseService);
      this.supabaseService.setAuthService(this.authService);
      this.supabaseService.setMessageHandler(this.messageHandler);
      this.messageHandler.setAuthService(this.authService);
      this.messageHandler.setStateManager(this);
      this.messageHandler.setEncryptionService(this.encryptionService);
      this.messageHandler.setSupabaseService(this.supabaseService);
      this.messageHandler.setReceivedContentStorage(this.receivedContentStorage);

      logger.info('All services created and dependencies set up');
    } catch (error) {
      this.setState(SystemState.ERROR, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  getState(): SystemState {
    return this.currentState;
  }

  getError(): Error | null {
    return this.error;
  }

  getAuthService(): AuthService {
    if (!this.authService) {
      throw new Error('AuthService not initialized');
    }
    return this.authService;
  }

  getSupabaseService(): SupabaseService {
    if (!this.supabaseService) {
      throw new Error('SupabaseService not initialized');
    }
    return this.supabaseService;
  }

  getEncryptionService(): EncryptionService {
    if (!this.encryptionService) {
      throw new Error('EncryptionService not initialized');
    }
    return this.encryptionService;
  }

  getMessageHandler(): MessageHandler {
    if (!this.messageHandler) {
      throw new Error('MessageHandler not initialized');
    }
    return this.messageHandler;
  }

  getReceivedContentStorage(): ReceivedContentStorage {
    if (!this.receivedContentStorage) {
      throw new Error('ReceivedContentStorage not initialized');
    }
    return this.receivedContentStorage;
  }

  private setState(newState: SystemState, error: Error | null = null) {
    this.currentState = newState;
    this.error = error;
    logger.info(`System state changed to: ${newState}`);
  }

  async initialize(): Promise<void> {
    try {
      // First initialize all services and set up dependencies
      await this.initializeServices();

      if (!this.authService || !this.supabaseService || !this.encryptionService) {
        throw new Error('Required services not initialized');
      }

      // Start connection process
      this.setState(SystemState.CONNECTING);
      try {
        await this.supabaseService.initialize();
        this.setState(SystemState.CONNECTED);
      } catch (error) {
        logger.error('Failed to connect to Supabase:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error,
          state: this.currentState
        });
        throw error;
      }

      // Initialize auth service first
      try {
        await this.authService.initialize();
      } catch (error) {
        logger.error('Failed to initialize auth service:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error,
          state: this.currentState
        });
        throw error;
      }

      // Start authentication process
      this.setState(SystemState.AUTHENTICATING);
      
      // First try to get existing session
      let session = await this.authService.getSession();
      
      // If no valid session, we need to wait for OTP flow
      if (!session) {
        // Wait for authentication to complete
        const email = process.env.MCP_AUTH_EMAIL;
        if (!email) {
          throw new Error('MCP_AUTH_EMAIL environment variable is required');
        }
        
        // Start OTP flow and wait for it to complete
        await this.authService.signInWithOtp(email);
        
        // Wait for session to be established
        let attempts = 0;
        const maxAttempts = 10;
        while (!session && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          session = await this.authService.getSession();
          attempts++;
        }
        
        if (!session) {
          throw new Error('Authentication timed out - please check your email for OTP code');
        }
      }
      
      this.setState(SystemState.AUTHENTICATED);

      // Set up realtime subscriptions after authentication
      try {
        await this.supabaseService.setupRealtimeSubscriptions();
      } catch (error) {
        logger.error('Failed to setup realtime subscriptions:', {
          error: error instanceof Error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
          } : error,
          state: this.currentState
        });
        throw error;
      }

      // Check agent registration
      this.setState(SystemState.REGISTERING);
      const agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new Error('No authenticated agent found');
      }

      // Verify agent is registered (AuthService should have handled registration)
      const agent = await this.supabaseService.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent registration failed - please check logs for details');
      }
      
      this.setState(SystemState.REGISTERED);

      // System is ready
      this.setState(SystemState.READY);
      logger.info('All services initialized successfully');
    } catch (error) {
      const errorDetails = error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error;
      
      logger.error('Failed to initialize system:', {
        error: errorDetails,
        state: this.currentState,
        hasAuth: !!this.authService,
        hasSupabase: !!this.supabaseService,
        hasEncryption: !!this.encryptionService
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
      const errorMessage = `System not ready. Current state: ${this.currentState}\nMissing requirements:\n${requirements.map(req => `- ${req}`).join('\n')}`;
      
      throw new Error(errorMessage);
    }
  }

  async attemptRecovery(): Promise<void> {
    if (this.currentState === SystemState.ERROR) {
      logger.info('Attempting to recover from error state...');
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Recovery failed:', error);
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