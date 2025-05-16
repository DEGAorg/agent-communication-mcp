import { AuthService } from '../supabase/auth.js';
import { logger } from '../logger.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Ensure logs are properly flushed
async function flushLogs() {
  await new Promise(resolve => setTimeout(resolve, 100));
}

function logInfo(message: string) {
  logger.info(chalk.cyan('ℹ ') + chalk.blue(message));
}

function logSuccess(message: string) {
  logger.info(chalk.green('✓ ') + chalk.greenBright(message));
}

function logError(message: string, error?: any) {
  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(chalk.red('✗ ') + chalk.redBright(message + ': ') + chalk.yellow(errorMessage));
  } else {
    logger.error(chalk.red('✗ ') + chalk.redBright(message));
  }
}

function logWarning(message: string) {
  logger.info(chalk.yellow('! ') + chalk.yellowBright(message));
}

function logStep(message: string) {
  logger.info(chalk.magenta('→ ') + chalk.magentaBright(message));
}

function logDivider() {
  logger.info(chalk.gray('─'.repeat(50)));
}

async function setupAuth() {
  try {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      logError('MCP_AUTH_EMAIL environment variable is required');
      process.exit(1);
    }

    const authService = AuthService.getInstance();
    
    // Wait for session to be loaded
    await authService.getSession();
    
    // Check if already authenticated
    if (authService.isAuthenticated()) {
      const userId = authService.getCurrentUserId();
      logSuccess('Already authenticated with a valid session');
      logInfo(`User ID: ${userId}`);
      process.exit(0);
    }

    // Start the authentication flow
    logDivider();
    logStep('Starting authentication process...');
    
    // Send OTP and wait for all logs to be processed
    await authService.signInWithOtp(email);
    await flushLogs();
    
    // Add extra newline for better spacing
    logger.info('');
    
    logInfo('Please check your email. You should receive either:');
    logInfo('1. A registration acceptance email (if this is your first time)');
    logInfo('2. An OTP code email');
    
    // Add extra newline for better spacing
    logger.info('');
    logDivider();
    
    let hasReceivedCode = false;
    let code: string;
    let lastOtpRequest = Date.now();
    let otpRequestCount = 0;
    let registrationAccepted = false;
    
    while (!hasReceivedCode) {
      // Add extra newline before prompt
      logger.info('');
      const { emailType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'emailType',
          message: chalk.cyan('What type of email did you receive?'),
          choices: [
            { name: chalk.blue('Registration acceptance email'), value: 'registration' },
            { name: chalk.blue('OTP code email'), value: 'otp' }
          ]
        }
      ]);
      
      if (emailType === 'registration') {
        // Add extra newline before new messages
        logger.info('');
        logInfo('Please accept the registration by clicking the link in the email.');
        const { hasAccepted } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'hasAccepted',
            message: chalk.cyan('Have you accepted the registration?'),
            default: false
          }
        ]);
        
        if (hasAccepted) {
          registrationAccepted = true;
          logStep('Registration accepted. Requesting OTP code...');
          await authService.retryOtp();
          await flushLogs();
          lastOtpRequest = Date.now();
          // Add extra newline for better spacing
          logger.info('');
          logDivider();
          continue;
        } else {
          logWarning('Please accept the registration to continue.');
          // Add extra newline for better spacing
          logger.info('');
          continue;
        }
      }
      
      // If user selected OTP, they have received it
      hasReceivedCode = true;
    }
    
    // Now that user has confirmed receiving the code, prompt for it
    // Add extra newline before prompt
    logger.info('');
    const { otpCode } = await inquirer.prompt([
      {
        type: 'input',
        name: 'otpCode',
        message: chalk.cyan('Enter the 6-digit code sent to your email:'),
        validate: (input) => {
          if (!input) return chalk.red('Verification code is required');
          if (!/^\d{6}$/.test(input)) return chalk.red('Please enter a valid 6-digit code');
          return true;
        }
      }
    ]);
    
    code = otpCode;

    try {
      // Verify the OTP
      logStep('Verifying OTP code...');
      await authService.verifyOtp(email, code);
      await flushLogs();
      
      const userId = authService.getCurrentUserId();
      logDivider();
      logSuccess('Authentication successful! Session has been saved.');
      logInfo(`User ID: ${userId}`);
      logDivider();
      process.exit(0);
    } catch (error) {
      logError('Failed to verify OTP code', error);
      process.exit(1);
    }
  } catch (error) {
    logError('Authentication process failed', error);
    process.exit(1);
  }
}

async function checkAuth() {
  try {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      logError('MCP_AUTH_EMAIL environment variable is required');
      process.exit(1);
    }

    const authService = AuthService.getInstance();
    
    // Wait for session to be loaded
    await authService.getSession();
    
    const isAuthed = authService.isAuthenticated();
    
    if (isAuthed) {
      const userId = authService.getCurrentUserId();
      logSuccess('Authentication status: Authenticated');
      logInfo(`User ID: ${userId}`);
      process.exit(0);
    } else {
      logWarning('Authentication status: Not authenticated');
      logInfo('Please run "mcp auth setup" to authenticate');
      process.exit(1);
    }
  } catch (error) {
    logError('Failed to check authentication status', error);
    process.exit(1);
  }
}

async function retryAuth() {
  try {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      logError('MCP_AUTH_EMAIL environment variable is required');
      process.exit(1);
    }

    const authService = AuthService.getInstance();
    
    // Wait for session to be loaded
    await authService.getSession();
    
    logStep('Requesting new OTP code...');
    await authService.retryOtp();
    logSuccess('New OTP code has been sent. Please check your email.\n');
    logDivider();
    
    // Prompt for OTP verification
    await flushLogs();
    const { otpCode } = await inquirer.prompt([
      {
        type: 'input',
        name: 'otpCode',
        message: chalk.cyan('Enter the 6-digit code sent to your email:'),
        validate: (input) => {
          if (!input) return chalk.red('Verification code is required');
          if (!/^\d{6}$/.test(input)) return chalk.red('Please enter a valid 6-digit code');
          return true;
        }
      }
    ]);

    try {
      // Verify the OTP
      logStep('Verifying OTP code...');
      await authService.verifyOtp(email, otpCode);
      
      const userId = authService.getCurrentUserId();
      logDivider();
      logSuccess('Authentication successful! Session has been saved.');
      logInfo(`User ID: ${userId}`);
      logDivider();
      process.exit(0);
    } catch (error) {
      logError('Failed to verify OTP code', error);
      process.exit(1);
    }
  } catch (error) {
    logError('Failed to retry authentication', error);
    process.exit(1);
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
      logError('Unknown command. Available commands: setup, check, retry');
      logInfo('\nUsage:');
      logInfo('  mcp auth setup    - Set up authentication with email and OTP');
      logInfo('  mcp auth check    - Check current authentication status');
      logInfo('  mcp auth retry    - Retry OTP authentication');
      process.exit(1);
  }
}

main(); 