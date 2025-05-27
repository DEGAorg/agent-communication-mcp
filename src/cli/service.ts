import { AuthService } from '../supabase/auth.js';
import { logger } from '../logger.js';
import * as readline from 'readline';
import { createServer } from '../stdio-server.js';
import { ToolHandler } from '../tools.js';
import { SupabaseService } from '../supabase/service.js';
import { EncryptionService } from '../encryption/service.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { config } from '../config.js';
import { AppError } from '../errors/AppError.js';
import { handleError } from '../errors/errorHandler.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Predefined test service
const TEST_SERVICE = {
  name: 'Test Service',
  type: 'TEST_SERVICE',
  description: 'This is a test service for development and testing purposes',
  price: 25,
  example: 'Example output from the test service'
};

async function promptForServiceDetails() {
  const name = await new Promise<string>((resolve) => {
    rl.question('Enter service name: ', (name) => {
      resolve(name.trim());
    });
  });

  const type = await new Promise<string>((resolve) => {
    rl.question('Enter service type: ', (type) => {
      resolve(type.trim());
    });
  });

  const description = await new Promise<string>((resolve) => {
    rl.question('Enter service description: ', (description) => {
      resolve(description.trim());
    });
  });

  const price = await new Promise<number>((resolve) => {
    rl.question('Enter service price: ', (price) => {
      resolve(parseFloat(price.trim()));
    });
  });

  const example = await new Promise<string>((resolve) => {
    rl.question('Enter service example (optional): ', (example) => {
      resolve(example.trim());
    });
  });

  return {
    name,
    type,
    description,
    price,
    example: example || undefined
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ''}`;
  }
  return String(error);
}

async function registerService(useTestService: boolean = false) {
  // Ensure we have a valid session
  const authService = AuthService.getInstance();
  await authService.getSession();

  if (!authService.isAuthenticated()) {
    throw new AppError(
      'Not authenticated. Please run "yarn auth:setup" first.',
      'AUTH_REQUIRED',
      401
    );
  }

  // Initialize services
  const supabaseService = SupabaseService.getInstance();
  const encryptionService = new EncryptionService(config.agentId);
  const toolHandler = new ToolHandler(supabaseService, encryptionService);

  // Get service details
  const serviceDetails = useTestService ? TEST_SERVICE : await promptForServiceDetails();
  logger.info('Service details received:', serviceDetails);

  // Make the tool call directly using the ToolHandler
  const result = await toolHandler.handleToolCall('registerService', serviceDetails);
  logger.info('Service registration successful:', result);

  // Clean up
  await toolHandler.cleanup();
  process.exit(0);
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const useTestService = process.argv[2] === '--test';
  registerService(useTestService).catch((error) => {
    if (error instanceof AppError) {
      logger.error(error.message);
    } else {
      logger.error('Fatal error:', formatError(error));
    }
    process.exit(1);
  });
} 