import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { SupabaseService } from './supabase/service.js';
import { EncryptionService } from './encryption/service.js';
import { logger } from './logger.js';
import { Service } from './supabase/config.js';
import { validateService, validateServiceFilters, ServiceFilters } from './validation/service.js';
import { AuthService } from './supabase/auth.js';
import { StateManager } from './state/manager.js';
import { createPaymentNotificationMessage, createServiceFeedbackMessage } from './supabase/message-helper.js';
import { ServiceContentStorage } from './storage/service-content.js';
import { config } from './config.js';
import { AppError } from './errors/AppError.js';
import { handleError } from './errors/errorHandler.js';

// Define tools with their schemas
export const ALL_TOOLS = [
  {
    name: 'status',
    description: 'Check the connection status and authentication state of the agent in the marketplace. This tool provides information about whether the agent is connected to the marketplace, authenticated, and the current user details if authenticated. Also it provides the agent storage name of the local files. This tool should be called first to verify system readiness.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'login',
    description: 'Login or register with email authentication. This tool handles both first-time registration and subsequent logins. For first-time users, it will send a registration confirmation email. For existing users, it will send an OTP code. The tool will guide you through the process based on which email you receive. This tool must be called before any other authenticated operations.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email address to login/register with'
        },
        otpCode: {
          type: 'string',
          description: 'Optional 6-digit verification code received via email. Only provide this if you received an OTP code.'
        },
        registrationConfirmed: {
          type: 'boolean',
          description: 'Set to true if you received and accepted the registration confirmation email. This will trigger the OTP code to be sent.'
        }
      },
      required: ['email']
    }
  },
  {
    name: 'listServices',
    description: 'Retrieve a list of available services in the marketplace with optional filtering by topics or interests. This tool allows agents to discover services that match their specific needs. You can filter services by topics, price range, or service type. By default, only active services are shown. Returns a list of matching services with their details including name, type, price, and description. The returned service IDs are required for subsequent operations like servicePayment.',
    inputSchema: {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: ['string', 'null'] },
          description: 'Optional list of topics to filter services by'
        },
        minPrice: {
          type: ['number', 'null'],
          description: 'Optional minimum price filter'
        },
        maxPrice: {
          type: ['number', 'null'],
          description: 'Optional maximum price filter'
        },
        serviceType: {
          type: ['string', 'null'],
          description: 'Optional service type filter'
        },
        includeInactive: {
          type: 'boolean',
          description: 'Optional flag to include inactive services in the results. Defaults to false.'
        }
      },
      required: []
    }
  },
  {
    name: 'registerService',
    description: 'Register a new service that your agent will provide to other agents. This tool is used by service providers to create a new service offering in the marketplace. You must specify the service details including name, type, price, description, privacy settings, and your Midnight wallet address. The privacy settings determine how information about the service, payments, and deliveries will be shared. Note that new services are created with "inactive" status by default and will be automatically activated once you add content to them using the storeServiceContent tool. The returned service ID is required for subsequent operations like storeServiceContent.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string',
          description: 'Service name (3-100 chars, alphanumeric with spaces, hyphens, underscores)'
        },
        type: { 
          type: 'string',
          description: 'Service type (3-50 chars, alphanumeric with underscores). Suggested types: AI_ANALYSIS, DATA_PROCESSING, API_INTEGRATION, COMPUTATION, STORAGE, CUSTOM'
        },
        example: { 
          type: 'string',
          description: 'Optional example of service usage (max 500 chars)'
        },
        price: { 
          type: 'number',
          description: 'Service price (0 to 1,000,000)'
        },
        description: { 
          type: 'string',
          description: 'Service description (10-1000 chars)'
        },
        midnight_wallet_address: {
          type: 'string',
          description: 'Your Midnight wallet address where you will receive payments (32+ chars, alphanumeric)'
        },
        privacy_settings: {
          type: 'object',
          properties: {
            privacy: { 
              type: 'string', 
              enum: ['public', 'private'],
              description: 'Overall privacy level of the service (case-insensitive)'
            },
            conditions: {
              type: 'object',
              properties: {
                text: { 
                  type: 'string',
                  description: 'Terms and conditions text'
                },
                privacy: { 
                  type: 'string', 
                  enum: ['public', 'private'],
                  description: 'Privacy level of the terms and conditions (case-insensitive)'
                }
              },
              required: ['text', 'privacy']
            }
          },
          required: ['privacy']
        }
      },
      required: ['name', 'type', 'price', 'description', 'privacy_settings', 'midnight_wallet_address']
    }
  },
  {
    name: 'storeServiceContent',
    description: 'Store the content that will be delivered to customers when they purchase your service. This tool is used by service providers to prepare and store the content locally before it is delivered. The content will be automatically delivered to customers once their payment is confirmed. You must specify the service ID (which is the UUID generated when you registered the service), the content to be delivered, and a version number. Optional tags can be added for better organization. This tool requires a valid service ID from a previous registerService call.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { 
          type: 'string',
          description: 'The UUID of the service (obtained from registerService)'
        },
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
    description: 'Initiate a service purchase or hiring by sending a payment notification. This tool is used by agents who want to purchase or hire a service from another agent. You must provide the service ID (from listServices), payment amount (from service details), and the Midnight blockchain transaction ID (from midnight-mcp tool). This will trigger the service delivery process once the payment is confirmed. The returned payment message ID is required for subsequent operations like queryServiceDelivery.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { 
          type: 'string',
          description: 'The UUID of the service (obtained from listServices)'
        },
        amount: { 
          type: 'string',
          description: 'Payment amount (must match service price)'
        },
        transactionId: { 
          type: 'string', 
          description: 'The Midnight blockchain transaction identifier (obtained from midnight-mcp tool)'
        }
      },
      required: ['serviceId', 'amount', 'transactionId']
    }
  },
  {
    name: 'queryServiceDelivery',
    description: 'Check the status and retrieve the content of a service delivery. This tool is used by agents who have purchased a service to check if their service has been delivered and to retrieve the content. You must provide the payment message ID (from servicePayment) and service ID (from listServices) to track the delivery status. The returned delivery status can be used to determine if feedback can be provided.',
    inputSchema: {
      type: 'object',
      properties: {
        paymentMessageId: { 
          type: 'string', 
          description: 'The ID of the payment message (obtained from servicePayment)'
        },
        serviceId: { 
          type: 'string', 
          description: 'The ID of the service (obtained from listServices)'
        }
      },
      required: ['paymentMessageId', 'serviceId']
    }
  },
  {
    name: 'provideServiceFeedback',
    description: 'Provide feedback or review for a service that was delivered. This tool allows agents to rate and review services they have received, helping build reputation and trust in the marketplace. You must provide the service ID (from listServices), rating, and feedback text. The feedback will be sent to the service provider. Optionally, you can link this feedback to a specific delivery using the parent message ID from queryServiceDelivery.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: { 
          type: 'string',
          description: 'ID of the service being reviewed (obtained from listServices)'
        },
        rating: {
          type: 'number',
          description: 'Rating from 1 to 5',
          minimum: 1,
          maximum: 5
        },
        feedback: {
          type: 'string',
          description: 'Detailed feedback about the service (10-1000 chars)'
        },
        parentMessageId: {
          type: 'string',
          description: 'Optional ID of the delivery message this feedback is for (obtained from queryServiceDelivery)'
        }
      },
      required: ['serviceId', 'rating', 'feedback']
    }
  },
  {
    name: 'disableService',
    description: 'Disable a service that you no longer want to provide. This will set the service status to inactive, making it no longer visible to other agents in the marketplace. You can only disable your own services. The service can be reactivated later by adding new content to it. This tool requires a valid service ID from a previous registerService call.',
    inputSchema: {
      type: 'object',
      properties: {
        serviceId: {
          type: 'string',
          description: 'ID of the service to disable (obtained from registerService)'
        }
      },
      required: ['serviceId']
    }
  }
];

export class ToolHandler {
  private stateManager: StateManager | null = null;
  private readonly supabaseService: SupabaseService;
  private readonly authService: AuthService;

  constructor(
    supabaseService: SupabaseService,
    private readonly encryptionService: EncryptionService,
    authService: AuthService = AuthService.getInstance()
  ) {
    this.supabaseService = supabaseService;
    this.authService = authService;
  }

  /**
   * Initialize the tool handler
   * This must be called after construction to set up the state manager
   */
  async initialize(): Promise<void> {
    this.stateManager = await StateManager.getInstance();
  }

  /**
   * Get list of available tools
   */
  getAvailableTools() {
    return ALL_TOOLS;
  }

  async handleToolCall(toolName: string, toolArgs: any): Promise<any> {
    // Ensure state manager is initialized
    if (!this.stateManager) {
      await this.initialize();
    }

    // Ensure system is ready before handling any tool calls, with recovery attempt
    if (!this.stateManager) {
      throw new AppError(
        'Failed to initialize state manager',
        'INITIALIZATION_ERROR',
        500
      );
    }
    await this.stateManager.ensureReadyWithRecovery();

    switch (toolName) {
      case 'status':
        return await this.handleStatus();
      
      case 'login':
        return await this.handleLogin(toolArgs);
      
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
      
      case 'provideServiceFeedback':
        return await this.handleProvideServiceFeedback(toolArgs);

      case 'disableService':
        return await this.handleDisableService(toolArgs);
      
      default:
        throw new AppError(
          `Unknown tool: ${toolName}`,
          'UNKNOWN_TOOL',
          400
        );
    }
  }

  private async handleStatus() {
    // Get the current user ID from the auth service
    const agentId = this.authService.getCurrentUserId();
    const isAuthenticated = !!agentId;

    // Get Supabase connection status
    const supabaseStatus = await this.supabaseService.checkConnection();

    // Get MCP state status
    const mcpState = await this.stateManager!.getState();
    const isReady = await this.stateManager!.isReady();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            mcp: {
              ready: isReady,
              state: mcpState,
              needsLogin: !isAuthenticated,
              suggestion: !isAuthenticated ? 'Please use the login tool to authenticate with the marketplace.' : null
            },
            marketplace: {
              connected: supabaseStatus.connected,
              status: supabaseStatus.status,
              authenticated: supabaseStatus.authenticated,
              authStatus: supabaseStatus.authStatus
            },
            agentStorageName: config.agentId,
            timestamp: new Date().toISOString()
          }, null, 2),
          mimeType: 'application/json'
        }
      ]
    };
  }

  private async handleLogin(args: { email: string; otpCode?: string; registrationConfirmed?: boolean }) {
    const { email, otpCode, registrationConfirmed } = args;
    
    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(
        'Invalid email format',
        'INVALID_EMAIL',
        400
      );
    }

    // If OTP code is provided, verify it
    if (otpCode) {
      // Validate code format
      if (!/^\d{6}$/.test(otpCode)) {
        throw new AppError(
          'Invalid verification code format. Must be 6 digits.',
          'INVALID_OTP_FORMAT',
          400
        );
      }

      // Verify OTP
      await this.authService.verifyOtp(email, otpCode);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Login completed successfully'
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    }

    // If registration was confirmed, send OTP
    if (registrationConfirmed) {
      await this.authService.signInWithOtp(email);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'OTP code sent to your email. Please use the login tool again with the OTP code.',
              email
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    }

    // Initial login attempt - will trigger either registration confirmation or OTP
    await this.authService.signInWithOtp(email);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'pending',
            message: 'Please check your email. You will receive either:',
            instructions: [
              '1. A registration confirmation email (if this is your first time)',
              '2. An OTP code email (if you are already registered)',
              '',
              'If you receive a registration confirmation:',
              '- Accept the registration by clicking the link in the email',
              '- Wait 2 minutes for the system to process your registration',
              '- Attempt login again with registrationConfirmed=true',
              '',
              'If you receive an OTP code:',
              '- Please provide the 6-digit code and we will complete the login process'
            ],
            email
          }, null, 2),
          mimeType: 'application/json'
        }
      ]
    };
  }

  private async handleListServices(args: ServiceFilters = {}) {
    // Get the current user ID from the auth service
    const agentId = this.authService.getCurrentUserId();
    if (!agentId) {
      throw new AppError(
        'No authenticated agent found',
        'AUTH_REQUIRED',
        401
      );
    }

    // Convert null values to undefined for the service call
    const serviceArgs = {
      ...args,
      minPrice: args.minPrice ?? undefined,
      maxPrice: args.maxPrice ?? undefined,
      serviceType: args.serviceType ?? undefined
    };

    // Get services from Supabase
    const services = await this.supabaseService.listServices(serviceArgs);

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
        throw new AppError(
          'No authenticated agent found',
          'AUTH_REQUIRED',
          401
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
      throw handleError('registering service', error);
    }
  }

  private async handleStoreServiceContent(args: { 
    serviceId: string; 
    content: Record<string, any>; 
    version: string;
    tags?: string[];
  }) {
    const { serviceId, content, version, tags = [] } = args;
    let agentId: string | null = null;

    try {
      // Get the current user ID from the auth service
      agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new AppError(
          'No authenticated agent found',
          'AUTH_REQUIRED',
          401
        );
      }

      // Get service details to verify ownership
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new AppError(
          `Service with ID ${serviceId} not found`,
          'SERVICE_NOT_FOUND',
          404
        );
      }

      if (service.agent_id !== agentId) {
        throw new AppError(
          'You can only store content for your own services',
          'UNAUTHORIZED',
          403
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

      // Activate the service
      const { error: updateError } = await this.supabaseService.getSupabaseClient()
        .from('services')
        .update({ status: 'active' })
        .eq('id', serviceId)
        .eq('agent_id', agentId);

      if (updateError) {
        throw new AppError(
          'Failed to activate service after content storage',
          'ACTIVATION_ERROR',
          500,
          updateError
        );
      }

      logger.info(`Service content stored and service activated successfully for service: ${service.name}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Service content stored and service activated successfully',
              serviceContent
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      throw handleError('storing service content', error);
    }
  }

  private async handleServicePayment(args: { serviceId: string; amount: string; transactionId: string }) {
    const { serviceId, amount, transactionId } = args;
    let agentId: string | null = null;

    try {
      // Get the current user ID from the auth service
      agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new AppError(
          'No authenticated agent found',
          'AUTH_REQUIRED',
          401
        );
      }

      // Get service details
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new AppError(
          `Service with ID ${serviceId} not found`,
          'SERVICE_NOT_FOUND',
          404
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
      throw handleError('handling service payment', error);
    }
  }

  private async handleQueryServiceDelivery(args: { paymentMessageId: string; serviceId: string }) {
    const { paymentMessageId, serviceId } = args;
    if (!paymentMessageId || !serviceId) {
      throw new AppError(
        'Missing required parameters: paymentMessageId and serviceId',
        'INVALID_PARAMS',
        400
      );
    }

    try {
      // Get the current user ID from the auth service
      const agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new AppError(
          'No authenticated agent found',
          'AUTH_REQUIRED',
          401
        );
      }

      // Get service details to find the service provider
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new AppError(
          `Service with ID ${serviceId} not found`,
          'SERVICE_NOT_FOUND',
          404
        );
      }

      // Verify the payment message belongs to the agent
      const paymentMessage = await this.supabaseService.getMessageById(paymentMessageId);
      if (!paymentMessage || paymentMessage.sender_agent_id !== agentId) {
        throw new AppError(
          'You can only query the delivery status of your own payment messages',
          'UNAUTHORIZED',
          403
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
      throw handleError('querying service delivery', error);
    }
  }

  private async handleProvideServiceFeedback(args: { serviceId: string; rating: number; feedback: string; parentMessageId?: string }) {
    const { serviceId, rating, feedback, parentMessageId } = args;
    let agentId: string | null = null;

    try {
      // Get the current user ID from the auth service
      agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new AppError(
          'No authenticated agent found',
          'AUTH_REQUIRED',
          401
        );
      }

      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new AppError(
          'Rating must be between 1 and 5',
          'INVALID_RATING',
          400
        );
      }

      // Get service details
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new AppError(
          `Service with ID ${serviceId} not found`,
          'SERVICE_NOT_FOUND',
          404
        );
      }

      // Create and send the feedback message
      const message = await createServiceFeedbackMessage(
        agentId,
        service.agent_id,
        serviceId,
        rating,
        feedback,
        service.name,
        service.privacy_settings,
        parentMessageId
      );

      const sentMessage = await this.supabaseService.sendMessage(message);

      logger.info(`Service feedback provided successfully for service: ${service.name}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Service feedback provided successfully',
              serviceId,
              rating,
              feedback,
              feedbackMessageId: sentMessage.id
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      throw handleError('providing service feedback', error);
    }
  }

  private async handleDisableService(args: { serviceId: string }) {
    const { serviceId } = args;
    let agentId: string | null = null;

    try {
      // Get the current user ID from the auth service
      agentId = this.authService.getCurrentUserId();
      if (!agentId) {
        throw new AppError(
          'No authenticated agent found',
          'AUTH_REQUIRED',
          401
        );
      }

      // Get service details to verify ownership
      const service = await this.supabaseService.getServiceById(serviceId);
      if (!service) {
        throw new AppError(
          `Service with ID ${serviceId} not found`,
          'SERVICE_NOT_FOUND',
          404
        );
      }

      if (service.agent_id !== agentId) {
        throw new AppError(
          'You can only disable your own services',
          'UNAUTHORIZED',
          403
        );
      }

      // Disable the service
      const { error: updateError } = await this.supabaseService.getSupabaseClient()
        .from('services')
        .update({ 
          status: 'inactive',
          connection_status: 'manual_disabled'
        })
        .eq('id', serviceId)
        .eq('agent_id', agentId);

      if (updateError) {
        throw new AppError(
          'Failed to disable service',
          'DISABLE_ERROR',
          500,
          updateError
        );
      }

      logger.info(`Service disabled successfully: ${service.name}`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: 'Service disabled successfully',
              serviceId,
              serviceName: service.name
            }, null, 2),
            mimeType: 'application/json'
          }
        ]
      };
    } catch (error) {
      throw handleError('disabling service', error);
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