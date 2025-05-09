// dotenv
import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  McpError,
  ErrorCode,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './logger.js';
import { ToolHandler } from './tools.js';
import { AuthService } from './supabase/auth.js';
import { SupabaseService } from './supabase/service.js';
import { EncryptionService } from './encryption/service.js';

/**
 * Format error for logging
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Create and configure MCP server
 */
export function createServer() {
  logger.info('Creating Agent Communication MCP server');

  // Initialize services
  const authService = AuthService.getInstance();
  const supabaseService = new SupabaseService();
  const encryptionService = new EncryptionService();
  const toolHandler = new ToolHandler(supabaseService, encryptionService);

  // Create server instance
  const server = new Server(
    {
      name: 'agent-communication-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );

  // Set up request handlers
  setupRequestHandlers(server, toolHandler);

  // Create STDIO transport
  const transport = new StdioServerTransport();

  return {
    start: async () => {
      try {
        // Ensure we have a valid session
        await authService.getSession();
        
        await server.connect(transport);
        logger.info('Server started successfully');
      } catch (error) {
        logger.error('Failed to start server:', error);
        throw error;
      }
    },
    stop: async () => {
      try {
        await server.close();
        await toolHandler.cleanup();
        logger.info('Server stopped');
      } catch (error) {
        logger.error('Error stopping server:', error);
      }
    },
  };
}

/**
 * Helper function to handle errors uniformly
 */
function handleError(context: string, error: unknown): never {
  logger.error(`Error ${context}:`, error);

  if (error instanceof McpError) {
    throw error;
  }

  throw new McpError(
    ErrorCode.InternalError,
    `${context}: ${formatError(error)}`,
  );
}

/**
 * Set up server request handlers
 */
function setupRequestHandlers(server: Server, toolHandler: ToolHandler) {
  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;

      logger.info(`Tool call received: ${toolName}`);
      return await toolHandler.handleToolCall(toolName, toolArgs);
    } catch (error) {
      return handleError('handling tool call', error);
    }
  });

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      // TODO: Implement resource listing logic
      return { resources: [] };
    } catch (error) {
      return handleError('listing resources', error);
    }
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const resourceUri = request.params.uri;
      // TODO: Implement resource reading logic
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: 'application/json',
            text: JSON.stringify({ message: 'Resource placeholder' }),
          },
        ],
      };
    } catch (error) {
      handleError('reading resource', error);
    }
  });

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      return { tools: toolHandler.getAvailableTools() };
    } catch (error) {
      return handleError('listing tools', error);
    }
  });

  // Handle global errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
}

/**
 * Set up process exit signal handlers
 */
function setupExitHandlers(server: any) {
  const exitHandler = async () => {
    logger.info('Shutting down server...');
    await server.stop();
    process.exit(0);
  };

  // Handle various exit signals
  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);
  process.on('SIGUSR1', exitHandler);
  process.on('SIGUSR2', exitHandler);
}

/**
 * Main function - Program entry point
 */
async function main() {
  try {
    logger.info('Starting Agent Communication MCP server');
    const server = createServer();

    // Start server
    await server.start();
    logger.info('Main server started successfully');

    // Handle process exit signals
    setupExitHandlers(server);
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
} 