import { AuthService } from '../supabase/auth.js';
import { logger } from '../logger.js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function promptForEmail(): Promise<string> {
  return new Promise((resolve) => {
    rl.question('Enter your email: ', (email) => {
      resolve(email.trim());
    });
  });
}

async function promptForOtp(): Promise<string> {
  return new Promise((resolve) => {
    rl.question('Enter the 6-digit code sent to your email: ', (code) => {
      resolve(code.trim());
    });
  });
}

async function setupAuth() {
  try {
    const email = await promptForEmail();
    if (!email) {
      logger.error('Email is required');
      process.exit(1);
    }

    // Set the email in environment for this process
    process.env.MCP_AUTH_EMAIL = email;

    const authService = AuthService.getInstance();
    
    // Wait for session to be loaded
    await authService.getSession();
    
    // Check if already authenticated
    if (authService.isAuthenticated()) {
      const userId = authService.getCurrentUserId();
      logger.info('Already authenticated with a valid session');
      logger.info(`User ID: ${userId}`);
      process.exit(0);
    }

    // If not authenticated, start the OTP flow
    await authService.signInWithOtp(email);
    
    // Prompt for OTP verification
    const code = await promptForOtp();
    if (!code) {
      logger.error('Verification code is required');
      process.exit(1);
    }

    // Verify the OTP
    await authService.verifyOtp(email, code);
    
    const userId = authService.getCurrentUserId();
    logger.info('Authentication successful! Session has been saved.');
    logger.info(`User ID: ${userId}`);
    process.exit(0);
  } catch (error) {
    logger.error('Authentication failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function checkAuth() {
  try {
    const authService = AuthService.getInstance();
    
    // Wait for session to be loaded
    await authService.getSession();
    
    const isAuthed = authService.isAuthenticated();
    
    if (isAuthed) {
      const userId = authService.getCurrentUserId();
      logger.info('Authentication status: Authenticated');
      logger.info(`User ID: ${userId}`);
      process.exit(0);
    } else {
      logger.info('Authentication status: Not authenticated');
      logger.info('Please run "mcp auth setup" to authenticate');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Failed to check authentication:', error);
    process.exit(1);
  }
}

async function retryAuth() {
  try {
    const authService = AuthService.getInstance();
    
    // Wait for session to be loaded
    await authService.getSession();
    
    await authService.retryOtp();
    
    // Prompt for OTP verification
    const code = await promptForOtp();
    if (!code) {
      logger.error('Verification code is required');
      process.exit(1);
    }

    // Get email from environment
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      logger.error('MCP_AUTH_EMAIL environment variable is required');
      process.exit(1);
    }

    // Verify the OTP
    await authService.verifyOtp(email, code);
    
    const userId = authService.getCurrentUserId();
    logger.info('Authentication successful! Session has been saved.');
    logger.info(`User ID: ${userId}`);
    process.exit(0);
  } catch (error) {
    logger.error('Failed to retry authentication:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// CLI command handler
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'setup':
      await setupAuth();
      break;
    case 'check':
      await checkAuth();
      break;
    case 'retry':
      await retryAuth();
      break;
    default:
      logger.error('Unknown command. Available commands: setup, check, retry');
      logger.info('\nUsage:');
      logger.info('  mcp auth setup    - Set up authentication with email and OTP');
      logger.info('  mcp auth check    - Check current authentication status');
      logger.info('  mcp auth retry    - Retry OTP authentication');
      process.exit(1);
  }
}

main(); 