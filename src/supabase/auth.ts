import { supabase } from './config.js';
import { logger } from '../logger.js';
import * as fs from 'fs';
import * as path from 'path';

export class AuthService {
  private static instance: AuthService;
  private currentSession: any = null;
  private readonly POLL_INTERVAL: number;
  private readonly MAX_POLL_ATTEMPTS: number;
  private readonly SESSION_FILE: string;

  private constructor() {
    // Configure from environment variables
    this.POLL_INTERVAL = parseInt(process.env.MCP_AUTH_POLL_INTERVAL || '2000', 10);
    this.MAX_POLL_ATTEMPTS = parseInt(process.env.MCP_AUTH_MAX_POLL_ATTEMPTS || '30', 10);
    
    // Set up session file path in project root
    const projectRoot = process.cwd();
    const sessionDir = path.join(projectRoot, 'session');
    this.SESSION_FILE = path.join(sessionDir, 'auth.json');
    
    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { mode: 0o700 }); // Secure directory permissions
    }

    // Initialize session
    this.initializeFromEnv();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async initializeFromEnv() {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      throw new Error('MCP_AUTH_EMAIL environment variable is required');
    }

    // Try to load existing session
    if (await this.loadSession()) {
      logger.info('Loaded existing session');
      return;
    }

    // If no valid session, start magic link flow
    await this.signInWithMagicLink(email);
  }

  /**
   * Loads the session from persistent storage
   */
  private async loadSession(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.SESSION_FILE)) {
        return false;
      }

      const sessionData = JSON.parse(fs.readFileSync(this.SESSION_FILE, 'utf8'));
      
      // Validate session data
      if (!sessionData?.access_token || !sessionData?.refresh_token) {
        return false;
      }

      // Set the session in Supabase client
      const { data: { session }, error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token
      });

      if (error || !session) {
        return false;
      }

      this.currentSession = session;
      return true;
    } catch (error) {
      logger.warn('Failed to load session:', error);
      return false;
    }
  }

  /**
   * Saves the current session to persistent storage
   */
  private async saveSession(): Promise<void> {
    try {
      if (!this.currentSession) {
        return;
      }

      const sessionData = {
        access_token: this.currentSession.access_token,
        refresh_token: this.currentSession.refresh_token,
        expires_at: this.currentSession.expires_at
      };

      // Write session data with secure permissions
      fs.writeFileSync(this.SESSION_FILE, JSON.stringify(sessionData), {
        mode: 0o600 // Secure file permissions
      });
    } catch (error) {
      logger.error('Failed to save session:', error);
    }
  }

  /**
   * Signs in a user using magic link authentication
   * @param email User's email address
   */
  async signInWithMagicLink(email: string): Promise<void> {
    logger.info(`Sending magic link to ${email}...`);
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true
      }
    });

    if (error) {
      logger.error('Error sending magic link:', error);
      throw error;
    }

    logger.info('Magic link sent! Please check your email and click the link to authenticate.');
    logger.info('Waiting for authentication...');

    // Poll for session
    await this.pollForSession();
  }

  /**
   * Polls for a valid session after magic link authentication
   */
  private async pollForSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('Error checking session:', error);
          reject(error);
          return;
        }

        if (session) {
          this.currentSession = session;
          // Save the new session
          await this.saveSession();
          logger.info('Successfully authenticated!');
          resolve();
        } else {
          attempts++;
          if (attempts >= this.MAX_POLL_ATTEMPTS) {
            reject(new Error('Authentication timeout. Please try again.'));
            return;
          }
          // Check again after interval
          setTimeout(checkSession, this.POLL_INTERVAL);
        }
      };
      
      checkSession();
    });
  }

  /**
   * Retries magic link authentication
   */
  async retryMagicLink(): Promise<void> {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      throw new Error('MCP_AUTH_EMAIL environment variable is required');
    }
    await this.signInWithMagicLink(email);
  }

  async getSession(): Promise<any> {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('Error getting session:', error);
      throw error;
    }

    this.currentSession = session;
    // Update stored session if it changed
    if (session) {
      await this.saveSession();
    }
    return session;
  }

  isAuthenticated(): boolean {
    return !!this.currentSession;
  }

  getCurrentUserId(): string | null {
    return this.currentSession?.user?.id || null;
  }
} 