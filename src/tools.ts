import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SupabaseService } from './supabase/service.js';
import { EncryptionService } from './encryption/service.js';
import { logger } from './logger.js';

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
    private readonly encryptionService: EncryptionService
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
      throw error;
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