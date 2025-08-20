#!/usr/bin/env node
import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { FileManager, FileType } from '../src/utils/file-manager.js';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  agentId: string;
}

interface StoredToken {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user_id: string;
  email: string;
  created_at: string;
}

program
  .name('e2e-auth')
  .description('End-to-end authentication script for Supabase')
  .option('-e, --email <email>', 'Email address for authentication')
  .option('-c, --code <code>', 'OTP verification code')
  .option('-a, --agent-id <id>', 'Agent ID (defaults to AGENT_ID env var)')
  .option('-l, --load', 'Load existing token')
  .option('-s, --status', 'Check token status')
  .option('-r, --refresh', 'Refresh token if needed')
  .option('-d, --delete', 'Delete stored token')
  .parse(process.argv);

const options = program.opts();

class E2EAuth {
  private supabase: any;
  private fileManager: FileManager;
  private config: AuthConfig;

  constructor() {
    this.config = {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
      agentId: options.agentId || process.env.AGENT_ID || 'default'
    };

    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
    }

    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false, // We'll handle refresh manually
        persistSession: false    // We'll handle persistence manually
      }
    });

    this.fileManager = FileManager.getInstance({
      baseDir: '.storage',
      dirMode: 0o700,
      fileMode: 0o600
    });
  }

  private getTokenPath(): string {
    return this.fileManager.getPath(FileType.AUTH, this.config.agentId, 'e2e-token.json');
  }

  private async saveToken(session: any): Promise<void> {
    const tokenData: StoredToken = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user_id: session.user.id,
      email: session.user.email,
      created_at: new Date().toISOString()
    };

    this.fileManager.writeFile(
      FileType.AUTH,
      this.config.agentId,
      JSON.stringify(tokenData, null, 2),
      'e2e-token.json'
    );

    console.log(chalk.green('✅ Token saved successfully'));
    console.log(chalk.cyan(`Location: ${this.getTokenPath()}`));
  }

  private async loadToken(): Promise<StoredToken | null> {
    const tokenPath = this.getTokenPath();
    
    if (!fs.existsSync(tokenPath)) {
      return null;
    }

    try {
      const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      return tokenData;
    } catch (error) {
      console.error(chalk.red('Error loading token:'), error);
      return null;
    }
  }

  private async validateToken(tokenData: StoredToken): Promise<boolean> {
    try {
      // Set the session in Supabase client
      const { data: { session }, error } = await this.supabase.auth.setSession({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token
      });

      if (error || !session) {
        return false;
      }

      // Check if token is expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (session.expires_at && currentTime >= session.expires_at) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private async refreshToken(tokenData: StoredToken): Promise<StoredToken | null> {
    try {
      const { data: { session }, error } = await this.supabase.auth.refreshSession({
        refresh_token: tokenData.refresh_token
      });

      if (error || !session) {
        return null;
      }

      const newTokenData: StoredToken = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        user_id: session.user.id,
        email: session.user.email,
        created_at: tokenData.created_at
      };

      await this.saveToken(session);
      return newTokenData;
    } catch (error) {
      console.error(chalk.red('Error refreshing token:'), error);
      return null;
    }
  }

  async authenticate(email: string, code?: string): Promise<void> {
    if (!code) {
      // Send OTP
      console.log(chalk.cyan(`Sending OTP to ${email}...`));
      
      const { error } = await this.supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        }
      });

      if (error) {
        throw new Error(`Failed to send OTP: ${error.message}`);
      }

      console.log(chalk.green('✅ OTP sent successfully!'));
      console.log(chalk.yellow('Please check your email and run the script again with the --code option'));
      return;
    }

    // Verify OTP
    console.log(chalk.cyan('Verifying OTP...'));
    
    const { data: { session }, error } = await this.supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email'
    });

    if (error) {
      throw new Error(`OTP verification failed: ${error.message}`);
    }

    if (!session) {
      throw new Error('No session received after OTP verification');
    }

    console.log(chalk.green('✅ Authentication successful!'));
    await this.saveToken(session);
  }

  async loadAndValidate(): Promise<StoredToken | null> {
    const tokenData = await this.loadToken();
    
    if (!tokenData) {
      console.log(chalk.yellow('No stored token found'));
      return null;
    }

    console.log(chalk.cyan('Loading stored token...'));
    console.log(chalk.white(`User: ${tokenData.email}`));
    console.log(chalk.white(`Created: ${tokenData.created_at}`));

    const isValid = await this.validateToken(tokenData);
    
    if (!isValid) {
      console.log(chalk.yellow('Token is invalid or expired'));
      return null;
    }

    console.log(chalk.green('✅ Token is valid'));
    return tokenData;
  }

  async checkStatus(): Promise<void> {
    const tokenData = await this.loadToken();
    
    if (!tokenData) {
      console.log(chalk.yellow('No stored token found'));
      return;
    }

    console.log(chalk.cyan('Token Status:'));
    console.log(chalk.white(`User: ${tokenData.email}`));
    console.log(chalk.white(`User ID: ${tokenData.user_id}`));
    console.log(chalk.white(`Created: ${tokenData.created_at}`));
    
    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = tokenData.expires_at;
    const isExpired = currentTime >= expiresAt;
    const expiresIn = expiresAt - currentTime;
    
    if (isExpired) {
      console.log(chalk.red(`Status: EXPIRED (expired ${Math.abs(expiresIn)} seconds ago)`));
    } else {
      const hours = Math.floor(expiresIn / 3600);
      const minutes = Math.floor((expiresIn % 3600) / 60);
      console.log(chalk.green(`Status: VALID (expires in ${hours}h ${minutes}m)`));
    }
  }

  async refreshIfNeeded(): Promise<void> {
    const tokenData = await this.loadToken();
    
    if (!tokenData) {
      console.log(chalk.yellow('No stored token found'));
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const willExpireSoon = tokenData.expires_at - currentTime < 3600; // 1 hour

    if (willExpireSoon) {
      console.log(chalk.yellow('Token expires soon, refreshing...'));
      const newToken = await this.refreshToken(tokenData);
      
      if (newToken) {
        console.log(chalk.green('✅ Token refreshed successfully'));
      } else {
        console.log(chalk.red('Failed to refresh token'));
      }
    } else {
      console.log(chalk.green('Token is still valid, no refresh needed'));
    }
  }

  async deleteToken(): Promise<void> {
    const tokenPath = this.getTokenPath();
    
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
      console.log(chalk.green('✅ Token deleted successfully'));
    } else {
      console.log(chalk.yellow('No token found to delete'));
    }
  }
}

async function main() {
  try {
    const auth = new E2EAuth();

    if (options.delete) {
      await auth.deleteToken();
      return;
    }

    if (options.status) {
      await auth.checkStatus();
      return;
    }

    if (options.refresh) {
      await auth.refreshIfNeeded();
      return;
    }

    if (options.load) {
      const token = await auth.loadAndValidate();
      if (token) {
        console.log(chalk.green('Token loaded and validated successfully'));
      }
      return;
    }

    if (options.email) {
      await auth.authenticate(options.email, options.code);
      return;
    }

    // Default: try to load existing token
    const token = await auth.loadAndValidate();
    if (token) {
      console.log(chalk.green('Using existing valid token'));
    } else {
      console.log(chalk.yellow('No valid token found. Use --email to authenticate'));
      console.log(chalk.cyan('Usage examples:'));
      console.log(chalk.white('  yarn e2e:auth --email user@example.com'));
      console.log(chalk.white('  yarn e2e:auth --email user@example.com --code 123456'));
      console.log(chalk.white('  yarn e2e:auth --load'));
      console.log(chalk.white('  yarn e2e:auth --status'));
      console.log(chalk.white('  yarn e2e:auth --refresh'));
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
