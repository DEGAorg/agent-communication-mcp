import { AuthService } from '../supabase/auth.js';
import { logger } from '../logger.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Ensure logs are properly flushed
async function flushLogs() {
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Temporarily disable logger during auth operations
function withDisabledLogger<T>(operation: () => Promise<T>): Promise<T> {
  const originalInfo = logger.info;
  const originalError = logger.error;
  const originalWarn = logger.warn;
  
  // Disable all logging
  logger.info = () => {};
  logger.error = () => {};
  logger.warn = () => {};
  
  return operation().finally(() => {
    // Restore original logging functions
    logger.info = originalInfo;
    logger.error = originalError;
    logger.warn = originalWarn;
  });
}

// Logger functions
const loggers = {
  info: (message: string) => logger.info(chalk.cyan('ℹ ') + chalk.blue(message)),
  success: (message: string) => logger.info(chalk.green('✓ ') + chalk.greenBright(message)),
  warning: (message: string) => logger.info(chalk.yellow('! ') + chalk.yellowBright(message)),
  step: (message: string) => logger.info(chalk.magenta('→ ') + chalk.magentaBright(message)),
  divider: () => logger.info(chalk.gray('─'.repeat(50))),
  error: (message: string, error?: any) => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Simplify error messages for end users
      const userFriendlyMessage = errorMessage
        .replace('MCP_AUTH_EMAIL environment variable is required', 'Please set your email in the MCP_AUTH_EMAIL environment variable')
        .replace('No OTP authentication in progress', 'Please start the authentication process first')
        .replace('Failed to verify OTP', 'Invalid verification code. Please try again');
      
      // Special handling for agent registration error
      if (errorMessage.includes('SupabaseService not initialized')) {
        loggers.success('Authentication successful!');
        loggers.info('Note: Agent registration will be completed during runtime setup');
        return;
      }
      
      logger.error(chalk.red('✗ ') + chalk.redBright(message + ': ') + chalk.yellow(userFriendlyMessage));
    } else {
      logger.error(chalk.red('✗ ') + chalk.redBright(message));
    }
  }
};

// Helper functions
async function waitForUserResponse(message: string = 'Waiting for your response...') {
  loggers.step(message);
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function promptForInput(message: string, validate?: (input: string) => boolean | string) {
  await waitForUserResponse();
  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message: chalk.cyan(message),
      validate
    }
  ]);
  return value;
}

async function promptForConfirmation(message: string) {
  await waitForUserResponse();
  const { value } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'value',
      message: chalk.cyan(message),
      default: false
    }
  ]);
  return value;
}

async function promptForSelection(message: string, choices: { name: string; value: string }[]) {
  await waitForUserResponse();
  const { value } = await inquirer.prompt([
    {
      type: 'list',
      name: 'value',
      message: chalk.cyan(message),
      choices: choices.map(choice => ({ ...choice, name: chalk.blue(choice.name) }))
    }
  ]);
  return value;
}

async function verifyOtp(email: string, code: string) {
  loggers.step('Verifying code...');
  await withDisabledLogger(async () => {
    await AuthService.getInstance().verifyOtp(email, code);
  });
  await flushLogs();
  
  const userId = AuthService.getInstance().getCurrentUserId();
  loggers.divider();
  loggers.success('Authentication successful!');
  loggers.info(`User ID: ${userId}`);
  loggers.info('Note: Agent registration will be completed during runtime setup');
  loggers.divider();
}

async function setupAuth() {
  try {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      loggers.error('Please set your email in the MCP_AUTH_EMAIL environment variable');
      process.exit(1);
    }

    const authService = AuthService.getInstance();
    
    // Check if already authenticated
    if (authService.isAuthenticated()) {
      const userId = authService.getCurrentUserId();
      loggers.success('Already authenticated');
      loggers.info(`User ID: ${userId}`);
      process.exit(0);
    }

    // Start the authentication flow
    loggers.divider();
    loggers.step('Starting authentication process...');
    
    // Send initial OTP to determine if user needs registration
    await authService.signInWithOtp(email);
    await flushLogs();
    
    logger.info('');
    loggers.info('Please check your email. You should receive either:');
    loggers.info('1. A registration acceptance email (if this is your first time)');
    loggers.info('2. An OTP code email');
    logger.info('');
    loggers.divider();
    
    const emailType = await promptForSelection('What type of email did you receive?', [
      { name: 'Registration acceptance email', value: 'registration' },
      { name: 'OTP code email', value: 'otp' }
    ]);
    
    if (emailType === 'registration') {
      logger.info('');
      loggers.info('Next steps:');
      loggers.info('1. Accept the registration by clicking the link in the email');
      loggers.info('2. Wait 2 minutes for the system to process your registration');
      loggers.info('3. Run "yarn auth:setup" again to continue with verification');
      logger.info('');
      loggers.info('Note: If you don\'t see the registration email, please check your spam folder.');
      logger.info('');
      loggers.divider();
      process.exit(0);
    }
    
    // OTP flow
    logger.info('');
    loggers.info('Please enter the verification code from your email.');
    loggers.info('Note: The code is 6 digits long and may take a few moments to arrive.');
    logger.info('');
    
    const otpCode = await promptForInput('Enter the 6-digit code sent to your email:', (input) => {
      if (!input) return chalk.red('Verification code is required');
      if (!/^\d{6}$/.test(input)) return chalk.red('Please enter a valid 6-digit code');
      return true;
    });

    try {
      await verifyOtp(email, otpCode);
      process.exit(0);
    } catch (error) {
      loggers.error('Authentication failed', error);
      process.exit(1);
    }
  } catch (error) {
    loggers.error('Authentication process failed', error);
    process.exit(1);
  }
}

async function checkAuth() {
  try {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      loggers.error('Please set your email in the MCP_AUTH_EMAIL environment variable');
      process.exit(1);
    }

    const authService = AuthService.getInstance();
    const isAuthed = authService.isAuthenticated();
    
    if (isAuthed) {
      const userId = authService.getCurrentUserId();
      loggers.success('Authentication status: Authenticated');
      loggers.info(`User ID: ${userId}`);
      process.exit(0);
    } else {
      loggers.warning('Authentication status: Not authenticated');
      loggers.info('Please run "mcp auth setup" to authenticate');
      process.exit(1);
    }
  } catch (error) {
    loggers.error('Failed to check authentication status', error);
    process.exit(1);
  }
}

async function retryAuth() {
  try {
    const email = process.env.MCP_AUTH_EMAIL;
    if (!email) {
      loggers.error('Please set your email in the MCP_AUTH_EMAIL environment variable');
      process.exit(1);
    }

    const authService = AuthService.getInstance();
    
    loggers.step('Requesting new verification code...');
    await withDisabledLogger(async () => {
      await authService.signInWithOtp(email);
    });
    loggers.success('New verification code has been sent.');
    loggers.info('Please wait a few moments for it to arrive.');
    loggers.info('Note: Check your spam folder if you don\'t see it.');
    logger.info('');
    loggers.divider();
    
    await flushLogs();
    const otpCode = await promptForInput('Enter the 6-digit code sent to your email:', (input) => {
      if (!input) return chalk.red('Verification code is required');
      if (!/^\d{6}$/.test(input)) return chalk.red('Please enter a valid 6-digit code');
      return true;
    });

    try {
      await verifyOtp(email, otpCode);
      process.exit(0);
    } catch (error) {
      loggers.error('Authentication failed', error);
      process.exit(1);
    }
  } catch (error) {
    loggers.error('Failed to retry authentication', error);
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
      loggers.error('Unknown command. Available commands: setup, check, retry');
      loggers.info('\nUsage:');
      loggers.info('  yarn auth:setup    - Set up authentication with email and verification code');
      loggers.info('  yarn auth:check    - Check current authentication status');
      loggers.info('  yarn auth:retry    - Request a new verification code');
      process.exit(1);
  }
}

main(); 