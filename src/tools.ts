import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SupabaseService } from './supabase/service.js';
import { EncryptionService } from './encryption/service.js';
import { logger } from './logger.js';
import { Service } from './supabase/config.js';
import { validateService } from './validation/service.js';
import { AuthService } from './supabase/auth.js';
import { StateManager } from './state/manager.js';
import { createPaymentNotificationMessage, createMessageContent, createMessagePublic, createMessage } from './supabase/message-helper.js';
import { ServiceContentStorage } from './storage/service-content.js';
import { CONTENT_TYPES, TRANSACTION_TYPES, MESSAGE_STATUS, MESSAGE_PURPOSE, MESSAGE_TOPICS, ClientPrivacyPreferences, SERVICE_PRIVACY_LEVELS, hasEncryptedContent } from './supabase/message-types.js';
import { createServiceDeliveryMessage } from './supabase/message-helper.js';
import { ReceivedContentStorage } from './storage/received-content.js';

// Define tools with their schemas
export const ALL_TOOLS = [
  {
    name: 'listServices',
    description: 'Retrieve a list of available services in the marketplace with optional filtering by topics or interests. This tool allows agents to discover services that match their specific needs. You can filter services by topics, price range, or service type. Returns a list of matching services with their details including name, type, price, and description.',
    inputSchema: {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of topics to filter services by'
        },
        minPrice: {
          type: 'number',
          description: 'Optional minimum price filter'
        },
        maxPrice: {
          type: 'number',
          description: 'Optional maximum price filter'
        },
        serviceType: {
          type: 'string',
          description: 'Optional service type filter'
        }
      },
      required: []
    }
  },
  {
    name: 'registerService',
    description: 'Register a new service that your agent will provide to other agents. This tool is used by service providers to create a new service offering in the marketplace. You must specify the service details including name, type, price, description, and privacy settings. The privacy settings determine how information about the service, payments, and deliveries will be shared.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        type: { type: 'string' },
        example: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
        privacy_settings: {
          type: 'object',
          properties: {
            privacy: { type: 'string', enum: ['public', 'private'] },
            conditions: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                privacy: { type: 'string', enum: ['public', 'private'] }
              },
              required: ['text', 'privacy']
            }
          },
          required: ['privacy', 'conditions']
        }
      },
      required: ['name', 'type', 'price', 'description', 'privacy_settings']
    }
  },
  {
    name: 'storeServiceContent',
    description: 'Store the content that will be delivered to customers when they purchase your service. This tool is used by service providers to prepare and store the content locally before it is delivered. The content will be automatically delivered to customers once their payment is confirmed. You must specify the service ID, the content to be delivered, and a version number. Optional tags can be added for better organization.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        content: { type: 'object' },
        version: { type: 'string' },
        tags: { 
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['serviceId', 'content', 'version']
    }
  },
  {
    name: 'servicePayment',
    description: 'Initiate a service purchase or hiring by sending a payment notification. This tool is used by agents who want to purchase or hire a service from another agent. You must provide the service ID, payment amount, and the Midnight blockchain transaction ID that proves the payment. This will trigger the service delivery process once the payment is confirmed.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        amount: { type: 'string' },
        transactionId: { type: 'string', description: 'The Midnight blockchain transaction identifier' }
      },
      required: ['serviceId', 'amount', 'transactionId']
    }
  },
  {
    name: 'queryServiceDelivery',
    description: 'Check the status and retrieve the content of a service delivery. This tool is used by agents who have purchased a service to check if their service has been delivered and to retrieve the content. You must provide the payment message ID and service ID to track the delivery status.',
    inputSchema: {
      type: 'object',
      properties: {
        paymentMessageId: { type: 'string', description: 'The ID of the payment message' },
        serviceId: { type: 'string', description: 'The ID of the service' }
      },
      required: ['paymentMessageId', 'serviceId']
    }
  }
];

export class ToolHandler {
  private stateManager: StateManager | null;
  private readonly supabaseService: SupabaseService;
  private readonly authService: AuthService;

  constructor(
    supabaseService: SupabaseService,
    private readonly encryptionService: EncryptionService,
    authService: AuthService = AuthService.getInstance()
  ) {
    this.stateManager = StateManager.getInstance();
    this.supabaseService = supabaseService;
    this.authService = authService;
  }

  /**
   * Get list of available tools
   */
  getAvailableTools() {
    return ALL_TOOLS;
  }

  async handleToolCall(toolName: string, toolArgs: any): Promise<any> {
    try {
      // Ensure system is ready before handling any tool calls, with recovery attempt
      await this.stateManager?.ensureReadyWithRecovery();

      switch (toolName) {
        case 'listServices':
          return await this.handleListServices(toolArgs);
        
        case 'registerService':
          return await this.handleRegisterService(toolArgs);
        
        case 'storeServiceContent':
          return await this.handleStoreServiceContent(toolArgs);
        
        case 'servicePayment':
          return await this.handleServicePayment(toolArgs);
        
        case 'queryServiceDelivery':
          return await this.handleQueryServiceDelivery(toolArgs);
        
        default:
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown tool: ${toolName}`
          );
      }
    } catch (error) {
      logger.error({
        msg: `Error handling tool call for ${toolName}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          toolName,
          args: JSON.stringify(toolArgs)
        }
      });
      
      // If it's a system not ready error, provide more specific error code
      if (error instanceof Error && error.message.includes('System not ready')) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          error.message
        );
      }
      
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Error handling tool call for ${toolName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleListServices(args: { 
    topics?: string[]; 
    minPrice?: number; 
    maxPrice?: number; 
    serviceType?: string; 
  } = {}) {
    try {
      const services = await this.supabaseService.listServices(args);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total: services.length,
              services,
              filters: args
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      const context = {
        agentId: this.authService.getCurrentUserId() || 'unknown',
        filters: args
      };
      
      logger.error({
        msg: 'Error listing services',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context
      });
      
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list services: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleRegisterService(args: Omit<Service, 'id' | 'agent_id'>) {
    let agentId: string | null = null;
    try {
      logger.info('Validating service data');
      // Validate the service data
      validateService(args);

      // Get the current user ID from the auth service
      agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'No authenticated agent found'
        );
      }

      logger.info(`Registering service with agent ID: ${agentId}`);
      const service = await this.supabaseService.registerService({
        agent_id: agentId,
        ...args
      });

      logger.info(`Service registered successfully: ${service.name}`);
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
      logger.error({
        msg: 'Error registering service',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          agentId: agentId || 'unknown',
          serviceData: JSON.stringify(args),
          timestamp: new Date().toISOString()
        }
      });
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to register service: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleStoreServiceContent(args: { 
    serviceId: string; 
    content: Record<string, any>; 
    version: string;
    tags?: string[];
  }) {
    const { serviceId, content, version, tags = [] } = args;

    try {
      // Get the current user ID from the auth service
      const agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'No authenticated agent found'
        );
      }

      // Verify the service exists and belongs to the agent
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Service with ID ${serviceId} not found`
        );
      }

      if (service.agent_id !== agentId) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'You can only store content for your own services'
        );
      }

      // Store the service content locally
      const serviceContentStorage = ServiceContentStorage.getInstance();
      const serviceContent = await serviceContentStorage.storeContent({
        service_id: serviceId,
        agent_id: agentId,
        content,
        version,
        tags
      });

      logger.info(`Service content stored successfully for service: ${service.name}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Service content stored successfully',
              serviceContent
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      logger.error({
        msg: 'Error storing service content',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          serviceId,
          version,
          contentLength: content.length,
          timestamp: new Date().toISOString()
        }
      });
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to store service content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleServicePayment(args: { serviceId: string; amount: string; transactionId: string }) {
    const { serviceId, amount, transactionId } = args;
    if (!serviceId || !amount || !transactionId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: serviceId, amount, and transactionId'
      );
    }

    try {
      // Get the current user ID from the auth service
      const agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'No authenticated agent found'
        );
      }

      // Get service details to find the service provider
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Service with ID ${serviceId} not found`
        );
      }

      // Create and send the payment notification message
      const message = await createPaymentNotificationMessage(
        agentId,
        service.agent_id,
        serviceId,
        amount,
        service.name,
        transactionId,
        service.privacy_settings
      );

      const sentMessage = await this.supabaseService.sendMessage(message);

      logger.info(`Payment notification sent successfully for service: ${service.name}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Payment notification sent successfully',
              serviceId,
              amount,
              transactionId,
              paymentMessageId: sentMessage.id
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      logger.error({
        msg: 'Error handling service payment',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          serviceId: args.serviceId,
          transactionId: args.transactionId,
          amount: args.amount,
          timestamp: new Date().toISOString()
        }
      });
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to handle service payment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleQueryServiceDelivery(args: { paymentMessageId: string; serviceId: string }) {
    const { paymentMessageId, serviceId } = args;
    if (!paymentMessageId || !serviceId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: paymentMessageId and serviceId'
      );
    }

    try {
      // Get the current user ID from the auth service
      const agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'No authenticated agent found'
        );
      }

      // Get service details to find the service provider
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Service with ID ${serviceId} not found`
        );
      }

      // Verify the payment message belongs to the agent
      const paymentMessage = await this.supabaseService.getMessageById(paymentMessageId);
      if (!paymentMessage || paymentMessage.sender_agent_id !== agentId) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'You can only query the delivery status of your own payment messages'
        );
      }

      // Check the delivery status
      const deliveryStatus = await this.supabaseService.checkServiceDelivery(paymentMessageId, serviceId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Service delivery status retrieved successfully',
              deliveryStatus
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      logger.error({
        msg: 'Error querying service delivery',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          paymentMessageId,
          serviceId
        }
      });
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to query service delivery: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up ToolHandler');
      
      // Clean up Supabase service
      if (this.supabaseService) {
        await this.supabaseService.cleanup();
      }

      // Clear service references
      this.stateManager = null;

      logger.info('ToolHandler cleanup completed');
    } catch (error) {
      logger.error({
        msg: 'Error during ToolHandler cleanup',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          operation: 'cleanup',
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
  }
}