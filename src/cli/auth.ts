import { AuthService } from '../supabase/auth.js';
import { logger } from '../logger.js';

async function retryAuth() {
  try {
    const authService = AuthService.getInstance();
    await authService.retryMagicLink();
  } catch (error) {
    logger.error('Failed to retry authentication:', error);
    process.exit(1);
  }
}

// CLI command handler
async function main() {
  const command = process.argv[2];

  if (command === 'retry') {
    await retryAuth();
  } else {
    logger.error('Unknown command. Available commands: retry');
    process.exit(1);
  }
}

main(); 