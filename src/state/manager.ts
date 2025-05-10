import { logger } from '../logger.js';
import { AuthService } from '../supabase/auth.js';
import { SupabaseService } from '../supabase/service.js';
import { EncryptionService } from '../encryption/service.js';

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
  private authService: AuthService;
  private supabaseService: SupabaseService;
  private encryptionService: EncryptionService;

  private constructor() {
    this.authService = AuthService.getInstance();
    this.supabaseService = new SupabaseService();
    this.encryptionService = new EncryptionService();
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
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

  private setState(newState: SystemState, error: Error | null = null) {
    this.currentState = newState;
    this.error = error;
    logger.info(`System state changed to: ${newState}`);
  }

  async initialize(): Promise<void> {
    try {
      // Start connection process
      this.setState(SystemState.CONNECTING);
      await this.supabaseService.initialize();
      this.setState(SystemState.CONNECTED);

      // Initialize auth service first
      await this.authService.initialize();

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
    } catch (error) {
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
      await this.supabaseService.cleanup();
      this.setState(SystemState.UNINITIALIZED);
    } catch (error) {
      this.setState(SystemState.ERROR, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
} 