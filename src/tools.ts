import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SupabaseService } from './supabase/service.js';
import { EncryptionService } from './encryption/service.js';
import { logger } from './logger.js';
import { Service } from './supabase/config.js';
import { validateService } from './validation/service.js';
import { AuthService } from './supabase/auth.js';

// Define tools with their schemas
export const ALL_TOOLS = [
  {
    name: 'listServices',
    description: 'List all available services',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'registerService',
    description: 'Register a new service',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        example: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' }
      },
      required: ['name', 'type', 'price', 'description']
    }
  },
  {
    name: 'servicePayment',
    description: 'Handle service payment',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        amount: { type: 'string' }
      },
      required: ['serviceId', 'amount']
    }
  },
  {
    name: 'serviceDelivery',
    description: 'Deliver service data',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        data: { type: 'object' }
      },
      required: ['serviceId', 'data']
    }
  },
  {
    name: 'revealData',
    description: 'Reveal encrypted data',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string' }
      },
      required: ['messageId']
    }
  }
];

export class ToolHandler {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryptionService: EncryptionService,
    private readonly authService: AuthService = AuthService.getInstance()
  ) {}

  /**
   * Get list of available tools
   */
  getAvailableTools() {
    return ALL_TOOLS;
  }

  async handleToolCall(toolName: string, toolArgs: any): Promise<any> {
    try {
      switch (toolName) {
        case 'listServices':
          return await this.handleListServices();
        
        case 'registerService':
          return await this.handleRegisterService(toolArgs);
        
        case 'servicePayment':
          return await this.handleServicePayment(toolArgs);
        
        case 'serviceDelivery':
          return await this.handleServiceDelivery(toolArgs);
        
        case 'revealData':
          return await this.handleRevealData(toolArgs);
        
        default:
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown tool: ${toolName}`
          );
      }
    } catch (error) {
      logger.error(`Error handling tool call for ${toolName}:`, error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Error handling tool call for ${toolName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleListServices() {
    const services = await this.supabaseService.listServices();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(services, null, 2),
          mimeType: 'application/json'
        }
      ]
    };
  }

  private async handleRegisterService(args: Omit<Service, 'id' | 'agent_id'>) {
    try {
      logger.info('Validating service data:', args);
      // Validate the service data
      validateService(args);

      // Get the current user ID from the auth service
      const agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'No authenticated agent found'
        );
      }

      logger.info('Registering service with agent ID:', agentId);
      const service = await this.supabaseService.registerService({
        agent_id: agentId,
        ...args
      });

      logger.info('Service registered successfully:', service);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(service, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      logger.error('Error registering service:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to register service: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleServicePayment(args: { serviceId: string; amount: string }) {
    const { serviceId, amount } = args;
    if (!serviceId || !amount) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: serviceId and amount'
      );
    }

    // TODO: Implement payment logic
    throw new Error('Not implemented: Service payment');
  }

  private async handleServiceDelivery(args: { serviceId: string; data: any }) {
    const { serviceId, data } = args;
    if (!serviceId || !data) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: serviceId and data'
      );
    }

    // TODO: Implement service delivery logic
    throw new Error('Not implemented: Service delivery');
  }

  private async handleRevealData(args: { messageId: string }) {
    const { messageId } = args;
    if (!messageId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: messageId'
      );
    }

    // TODO: Implement data revelation logic
    throw new Error('Not implemented: Data revelation');
  }

  async cleanup() {
    await this.supabaseService.cleanup();
  }
} 