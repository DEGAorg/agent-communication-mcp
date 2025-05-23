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
import { StateManager } from './state/manager.js';
import { handleListResources, handleReadResource } from './resources.js';
import { AuthService } from './supabase/auth.js';

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
export async function createServer() {
  logger.info('Creating Agent Communication MCP server');

  // Initialize state manager (which handles all service initialization)
  const stateManager = await StateManager.getInstance();
  await stateManager.initialize();

  const toolHandler = new ToolHandler(
    stateManager.getSupabaseService(),
    stateManager.getEncryptionService(),
    stateManager.getAuthService()
  );

  // Initialize the tool handler
  await toolHandler.initialize();

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
        await stateManager.cleanup();
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
  logger.error({
    msg: `Error ${context}`,
    error: error instanceof Error ? error.message : 'Unknown error',
    details: error instanceof Error ? error.stack : String(error),
    context: {
      operation: context,
      timestamp: new Date().toISOString()
    }
  });

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
      
      // Check if tool requires authentication
      const authRequiredTools = [
        'listServices',
        'registerService',
        'storeServiceContent',
        'servicePayment',
        'queryServiceDelivery',
        'provideServiceFeedback'
      ];

      if (authRequiredTools.includes(toolName)) {
        const authService = AuthService.getInstance();
        if (!authService.isAuthenticated()) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Authentication required. Please use the login tool to authenticate first.'
          );
        }
      }

      return await toolHandler.handleToolCall(toolName, toolArgs);
    } catch (error) {
      return handleError('handling tool call', error);
    }
  });

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return { resources: handleListResources() };
    } catch (error) {
      return handleError('listing resources', error);
    }
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const resourceUri = request.params.uri;
      const resource = handleReadResource(resourceUri);
      
      return {
        contents: [{
          uri: resourceUri,
          mimeType: resource.mimeType || "application/json",
          text: JSON.stringify(resource)
        }]
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
  const exitHandler = async (signal?: string) => {
    logger.info(`Shutting down server (${signal})`);
    await server.stop();
    process.exit(0);
  };

  // Handle various exit signals
  process.on('SIGINT', () => exitHandler('SIGINT'));
  process.on('SIGTERM', () => exitHandler('SIGTERM'));
  process.on('SIGUSR1', () => exitHandler('SIGUSR1'));
  process.on('SIGUSR2', () => exitHandler('SIGUSR2'));
}

/**
 * Main function - Program entry point
 */
async function main() {
  try {
    logger.info('Starting Agent Communication MCP server');
    const server = await createServer();

    // Start server
    await server.start();
    logger.info('Main server started successfully');

    // Handle process exit signals
    setupExitHandlers(server);
  } catch (error) {
    logger.error({
      msg: 'Failed to start server',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : String(error),
      context: {
        operation: 'server_startup',
        timestamp: new Date().toISOString()
      }
    });
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error({
      msg: 'Fatal error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : String(error),
      context: {
        operation: 'main_execution',
        timestamp: new Date().toISOString()
      }
    });
    process.exit(1);
  });
} 