import { Message, MESSAGE_TOPICS, CONTENT_TYPES, TRANSACTION_TYPES, MESSAGE_STATUS } from './message-types.js';
import { logger } from '../logger.js';
import { ServiceContentStorage } from '../storage/service-content.js';
import { StateManager } from '../state/manager.js';
import { EncryptionService } from '../encryption/service.js';
import { AuthService } from './auth.js';
import { SupabaseService } from './service.js';
import { createServiceDeliveryMessage } from './message-helper.js';

export class MessageHandler {
  private static instance: MessageHandler;
  private stateManager: StateManager | null = null;
  private encryptionService: EncryptionService | null = null;
  private authService: AuthService | null = null;
  private supabaseService: SupabaseService | null = null;

  private constructor() {}

  static getInstance(): MessageHandler {
    if (!MessageHandler.instance) {
      MessageHandler.instance = new MessageHandler();
    }
    return MessageHandler.instance;
  }

  setStateManager(stateManager: StateManager) {
    this.stateManager = stateManager;
  }

  setEncryptionService(encryptionService: EncryptionService) {
    this.encryptionService = encryptionService;
  }

  setAuthService(authService: AuthService) {
    this.authService = authService;
  }

  setSupabaseService(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      if (!this.stateManager || !this.encryptionService || !this.authService || !this.supabaseService) {
        throw new Error('Required services not initialized');
      }

      // Ensure system is ready before handling any messages
      await this.stateManager.ensureReadyWithRecovery();

      const { public: publicContent, private: privateContent } = message;
      const { topic, content } = publicContent;

      // Decrypt private content if it exists
      let decryptedPrivateContent: Record<string, any> = {};
      if (privateContent) {
        const recipientPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
        
        // Get sender's public key from database
        const senderPublicKeyBase64 = await this.supabaseService!.getAgentPublicKey(message.sender_agent_id);
        if (!senderPublicKeyBase64) {
          throw new Error(`Sender agent ${message.sender_agent_id} not found or has no public key`);
        }
        const senderPublicKey = Buffer.from(senderPublicKeyBase64, 'base64');
        
        decryptedPrivateContent = JSON.parse(
          await this.encryptionService.decryptMessage(
            privateContent.encryptedMessage,
            privateContent.encryptedKeys.recipient,
            senderPublicKey,
            recipientPrivateKey
          )
        );
      }

      switch (topic) {
        case MESSAGE_TOPICS.DELIVERY:
          await this.handleDeliveryMessage(message, decryptedPrivateContent);
          break;
        case MESSAGE_TOPICS.PAYMENT:
          await this.handlePaymentMessage(message, decryptedPrivateContent);
          break;
        default:
          logger.warn(`Unhandled message topic: ${topic}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      throw error;
    }
  }

  private async handleDeliveryMessage(message: Message, privateContent: Record<string, any>): Promise<void> {
    const { public: publicContent } = message;
    const { content } = publicContent;

    if (content.type === CONTENT_TYPES.TRANSACTION && content.data.type === TRANSACTION_TYPES.SERVICE_DELIVERY) {
      const { serviceId } = publicContent;
      const { version } = content.data;

      if (!serviceId) {
        throw new Error('Service ID missing from delivery message');
      }

      // Get service details to check privacy settings
      const service = await this.supabaseService!.getServiceById(serviceId);
      if (!service) {
        throw new Error(`Service ${serviceId} not found`);
      }

      // Combine public and private content based on privacy settings
      const combinedContent = {
        ...content.data,
        // Include private content if it exists and privacy settings allow
        ...(privateContent.content && service.privacy_settings.deliveryPrivacy !== 'public' ? {
          content: privateContent.content
        } : {}),
        // Include conditions if they exist and privacy settings allow
        ...(privateContent.conditions && service.privacy_settings.conditions.privacy !== 'public' ? {
          conditions: privateContent.conditions
        } : {})
      };

      // Store the delivered content
      const serviceContentStorage = ServiceContentStorage.getInstance();
      await serviceContentStorage.storeContent({
        service_id: serviceId,
        agent_id: message.recipient_agent_id,
        content: combinedContent,
        version,
        tags: ['delivered']
      });

      logger.info(`Service content delivered for service ${serviceId}, version ${version}`);
    }
  }

  private async handlePaymentMessage(message: Message, privateContent: Record<string, any>): Promise<void> {
    const { public: publicContent } = message;
    const { content } = publicContent;

    if (content.type === CONTENT_TYPES.TRANSACTION && content.data.type === TRANSACTION_TYPES.PAYMENT_NOTIFICATION) {
      const { serviceId } = publicContent;
      
      if (!serviceId) {
        throw new Error('Service ID missing from payment message');
      }

      // Get service details to check privacy settings
      const service = await this.supabaseService!.getServiceById(serviceId);
      if (!service) {
        throw new Error(`Service ${serviceId} not found`);
      }

      // Combine public and private content based on privacy settings
      const combinedContent = {
        ...content.data,
        // Include private payment details if they exist and privacy settings allow
        ...(privateContent.amount && service.privacy_settings.paymentPrivacy !== 'public' ? {
          amount: privateContent.amount
        } : {})
      };

      // Store payment details
      logger.info('Payment message processed:', {
        serviceId,
        content: combinedContent
      });

      // Get the stored service content
      const serviceContentStorage = ServiceContentStorage.getInstance();
      const serviceContent = await serviceContentStorage.getContent(serviceId);
      
      if (!serviceContent) {
        throw new Error(`No content found for service ${serviceId}`);
      }

      // Create and send the delivery message
      const deliveryMessage = await createServiceDeliveryMessage(
        service.agent_id, // sender is the service provider
        message.sender_agent_id, // recipient is the payment sender
        serviceId,
        serviceContent.content,
        serviceContent.version,
        service.name,
        service.privacy_settings,
        message.id, // Set parent_message_id to the payment message
        message.conversation_id // Use the same conversation_id as the payment message
      );

      await this.supabaseService!.sendMessage(deliveryMessage);
      logger.info(`Service delivery triggered automatically after payment for service ${serviceId}`, {
        conversation_id: message.conversation_id,
        parent_message_id: message.id
      });
    }
  }
} 