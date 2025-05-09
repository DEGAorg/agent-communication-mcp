import { supabase } from './config.js';
import { logger } from '../logger.js';
import * as fs from 'fs';
import * as path from 'path';

export class AuthService {
  private static instance: AuthService;
  private currentSession: any = null;
  private readonly SESSION_FILE: string;
  private isInitializing: boolean = false;
  private renewalInterval: NodeJS.Timeout | null = null;

  private constructor() {
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
    
    // Start periodic session renewal check
    this.startSessionRenewalCheck();
  }

  private startSessionRenewalCheck() {
    // Check every 30 minutes
    this.renewalInterval = setInterval(() => {
      this.renewSessionIfNeeded().catch(error => {
        logger.error('Error in session renewal check:', error);
      });
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
  }

  private async renewSessionIfNeeded() {
    const { data, error } = await supabase.auth.getSession();

    const session = data.session;
    if (!session || !session.refresh_token) return;

    const currentTime = Math.floor(Date.now() / 1000);
    const willExpireSoon = session.expires_at && currentTime > session.expires_at - 86400; // 1 day before expiration

    if (willExpireSoon) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        logger.error('Failed to refresh session:', refreshError.message);
      } else {
        logger.info('🔄 Session refreshed');
        this.currentSession = refreshed.session;
        await this.saveSession(); // save new access/refresh tokens
      }
    }
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
    const hasValidSession = await this.loadSession();
    if (hasValidSession) {
      logger.info('Found and loaded existing valid session');
      return;
    }

    logger.info('No valid session found. Starting new authentication flow...');
    // If no valid session and not already initializing, start OTP flow
    if (!this.isInitializing) {
      this.isInitializing = true;
      await this.signInWithOtp(email);
      this.isInitializing = false;
    }
  }

  /**
   * Loads the session from persistent storage
   * @returns true if a valid session was loaded, false otherwise
   */
  private async loadSession(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.SESSION_FILE)) {
        logger.info('No session file found');
        return false;
      }

      const sessionData = JSON.parse(fs.readFileSync(this.SESSION_FILE, 'utf8'));
      
      // Validate session data
      if (!sessionData?.access_token || !sessionData?.refresh_token) {
        logger.info('Session file exists but contains invalid data');
        return false;
      }

      // Set the session in Supabase client
      const { data: { session }, error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token
      });

      if (error || !session) {
        logger.info('Failed to restore session from file');
        return false;
      }

      this.currentSession = session;
      return true;
    } catch (error) {
      logger.warn('Error loading session:', error);
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
   * Signs in a user using OTP authentication
   * @param email User's email address
   */
  async signInWithOtp(email: string): Promise<void> {
    if (this.isInitializing) {
      logger.info('Authentication already in progress...');
      return;
    }

    logger.info(`Sending OTP to ${email}...`);
    
    try {
      this.isInitializing = true;
      // Try to sign in with OTP
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        }
      });

      if (error) {
        logger.error('Error sending OTP:', error);
        throw error;
      }

      logger.info('OTP sent! Please check your email for the verification code.');
    } catch (error) {
      this.isInitializing = false;
      logger.error('Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Verifies the OTP code and completes authentication
   * @param email User's email address
   * @param code The OTP code received via email
   */
  async verifyOtp(email: string, code: string): Promise<void> {
    try {
      const { data: { session }, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email'
      });

      if (error) {
        logger.error('Error verifying OTP:', error);
        throw error;
      }

      if (session) {
        this.currentSession = session;
        // Save the new session
        await this.saveSession();
        logger.info('Successfully authenticated!');
      } else {
        throw new Error('No session received after OTP verification');
      }
    } catch (error) {
      logger.error('OTP verification failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Retries OTP authentication
   */
  async retryOtp(): Promise<void> {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      throw new Error('MCP_AUTH_EMAIL environment variable is required');
    }
    await this.signInWithOtp(email);
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

  // Add cleanup method to clear interval when needed
  public cleanup() {
    if (this.renewalInterval) {
      clearInterval(this.renewalInterval);
      this.renewalInterval = null;
    }
  }
} 