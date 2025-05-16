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
import { CONTENT_TYPES, TRANSACTION_TYPES, MESSAGE_STATUS, MESSAGE_PURPOSE, MESSAGE_TOPICS, ClientPrivacyPreferences, SERVICE_PRIVACY_LEVELS } from './supabase/message-types.js';
import { createServiceDeliveryMessage } from './supabase/message-helper.js';
import { ReceivedContentStorage } from './storage/received-content.js';

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
        description: { type: 'string' },
        privacy_settings: {
          type: 'object',
          properties: {
            contentPrivacy: { type: 'string', enum: ['public', 'private', 'mixed'] },
            paymentPrivacy: { type: 'string', enum: ['public', 'private', 'mixed'] },
            deliveryPrivacy: { type: 'string', enum: ['public', 'private', 'mixed'] },
            conditions: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                privacy: { type: 'string', enum: ['public', 'private', 'mixed'] }
              },
              required: ['text', 'privacy']
            }
          },
          required: ['contentPrivacy', 'paymentPrivacy', 'deliveryPrivacy', 'conditions']
        }
      },
      required: ['name', 'type', 'price', 'description', 'privacy_settings']
    }
  },
  {
    name: 'storeServiceContent',
    description: 'Store content for a service that will be delivered to customers',
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
    description: 'Handle service payment',
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
    name: 'serviceDelivery',
    description: 'Deliver service data',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        data: { type: 'object' },
        privacyPreferences: {
          type: 'object',
          properties: {
            deliveryPrivacy: { type: 'string', enum: ['public', 'private', 'mixed'] }
          },
          required: ['deliveryPrivacy']
        }
      },
      required: ['serviceId', 'data', 'privacyPreferences']
    }
  },
  {
    name: 'queryServiceDelivery',
    description: 'Query the status and content of a service delivery',
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
  private stateManager: StateManager;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly encryptionService: EncryptionService,
    private readonly authService: AuthService = AuthService.getInstance()
  ) {
    this.stateManager = StateManager.getInstance();
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
      await this.stateManager.ensureReadyWithRecovery();

      switch (toolName) {
        case 'listServices':
          return await this.handleListServices();
        
        case 'registerService':
          return await this.handleRegisterService(toolArgs);
        
        case 'storeServiceContent':
          return await this.handleStoreServiceContent(toolArgs);
        
        case 'servicePayment':
          return await this.handleServicePayment(toolArgs);
        
        case 'serviceDelivery':
          return await this.handleServiceDelivery(toolArgs);
        
        case 'queryServiceDelivery':
          return await this.handleQueryServiceDelivery(toolArgs);
        
        default:
          throw new McpError(
            ErrorCode.InvalidParams,
            `Unknown tool: ${toolName}`
          );
      }
    } catch (error) {
      logger.error({ err: error }, `Error handling tool call for ${toolName}`);
      
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
      logger.error({ err: error }, 'Error registering service');
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
      logger.error('Error storing service content:', error);
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

      await this.supabaseService.sendMessage(message);

      // Check if payment is private based on service privacy settings
      const isPrivatePayment = service.privacy_settings?.paymentPrivacy === SERVICE_PRIVACY_LEVELS.PRIVATE;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Payment notification sent successfully',
              serviceId,
              amount: isPrivatePayment ? '[PRIVATE]' : amount,
              transactionId
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      logger.error('Error handling service payment:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to process service payment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleServiceDelivery(args: { serviceId: string; data: any; privacyPreferences?: ClientPrivacyPreferences }) {
    const { serviceId, data, privacyPreferences } = args;
    if (!serviceId || !data) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: serviceId and data'
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

      // Get the stored service content
      const serviceContentStorage = ServiceContentStorage.getInstance();
      const serviceContent = await serviceContentStorage.getContent(serviceId);
      
      if (!serviceContent) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `No content found for service ${serviceId}`
        );
      }

      // Create and send the delivery message
      const message = await createServiceDeliveryMessage(
        service.agent_id, // sender is the service provider
        agentId, // recipient is the current agent
        serviceId,
        serviceContent.content,
        serviceContent.version,
        service.name,
        service.privacy_settings
      );

      await this.supabaseService.sendMessage(message);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Service content delivered successfully',
              serviceId,
              version: serviceContent.version,
              privacy: service.privacy_settings.deliveryPrivacy
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      logger.error('Error handling service delivery:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to deliver service content: ${error instanceof Error ? error.message : String(error)}`
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

      // Get the payment message to verify ownership
      const paymentMessage = await this.supabaseService.getMessageById(paymentMessageId);
      if (!paymentMessage) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Payment message ${paymentMessageId} not found`
        );
      }

      // Verify the agent is the recipient of the payment
      if (paymentMessage.sender_agent_id !== agentId) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Only the payment sender can query service delivery status'
        );
      }

      // First check received content storage
      const receivedContentStorage = ReceivedContentStorage.getInstance();
      const receivedContent = await receivedContentStorage.getContent(agentId, paymentMessageId);
      
      if (receivedContent) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'completed',
                message: 'Service content retrieved from local storage',
                serviceId,
                version: receivedContent.version,
                content: receivedContent.content,
                tags: receivedContent.tags,
                created_at: receivedContent.created_at,
                updated_at: receivedContent.updated_at
              }, null, 2),
              mimeType: 'application/json'
            }
          ]
        };
      }

      // If not found locally, check for delivery message
      const deliveryMessage = await this.supabaseService.getMessageByParentId(paymentMessageId);
      
      if (!deliveryMessage) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'pending',
                message: 'Service delivery not yet completed',
                serviceId,
                paymentMessageId
              }, null, 2),
              mimeType: 'application/json'
            }
          ]
        };
      }

      // If we have a delivery message but no local content, decrypt and store it
      try {
        const recipientPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
        const senderPublicKeyBase64 = await this.supabaseService.getAgentPublicKey(deliveryMessage.sender_agent_id);
        if (!senderPublicKeyBase64) {
          throw new Error(`Sender agent ${deliveryMessage.sender_agent_id} not found or has no public key`);
        }
        const senderPublicKey = Buffer.from(senderPublicKeyBase64, 'base64');
        
        const decryptedContent = JSON.parse(
          await this.encryptionService.decryptMessage(
            deliveryMessage.private.encryptedMessage,
            deliveryMessage.private.encryptedKeys.recipient,
            senderPublicKey,
            recipientPrivateKey
          )
        );
        
        // Store the decrypted content
        await receivedContentStorage.storeContent({
          payment_message_id: paymentMessageId,
          service_id: serviceId,
          content: decryptedContent,
          version: deliveryMessage.public.content.data.version,
          tags: ['received', 'decrypted']
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'completed',
                message: 'Service content decrypted and stored',
                serviceId,
                version: deliveryMessage.public.content.data.version,
                content: decryptedContent
              }, null, 2),
              mimeType: 'application/json'
            }
          ]
        };
      } catch (error) {
        logger.error('Error decrypting delivery message:', error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'error',
                message: 'Failed to decrypt delivery message',
                serviceId,
                deliveryMessageId: deliveryMessage.id
              }, null, 2),
              mimeType: 'application/json'
            }
          ]
        };
      }
    } catch (error) {
      logger.error('Error querying service delivery:', error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to query service delivery: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async cleanup() {
    await this.supabaseService.cleanup();
  }
} 