import { Message } from './message-types.js';
import { logger } from '../logger.js';
import { ServiceContentStorage } from '../storage/service-content.js';
import { StateManager } from '../state/manager.js';
import { EncryptionService } from '../encryption/service.js';
import { AuthService } from './auth.js';

export class MessageHandler {
  private static instance: MessageHandler;
  private stateManager: StateManager;
  private encryptionService: EncryptionService;
  private authService: AuthService;

  private constructor() {
    this.stateManager = StateManager.getInstance();
    this.encryptionService = new EncryptionService();
    this.authService = AuthService.getInstance();
  }

  static getInstance(): MessageHandler {
    if (!MessageHandler.instance) {
      MessageHandler.instance = new MessageHandler();
    }
    return MessageHandler.instance;
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      // Ensure system is ready before handling any messages
      await this.stateManager.ensureReadyWithRecovery();

      const { public: publicContent, private: privateContent } = message;
      const { topic, content } = publicContent;

      // Decrypt private content if it exists
      let decryptedPrivateContent: Record<string, any> = {};
      if (privateContent) {
        const recipientPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
        const senderPublicKey = Buffer.from(process.env.AGENT_PUBLIC_KEY!, 'base64');
        
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
        case 'delivery':
          await this.handleDeliveryMessage(message, decryptedPrivateContent);
          break;
        case 'payment':
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

    if (content.type === 'transaction' && content.data.type === 'service_delivery') {
      const { serviceId } = publicContent;
      const { content: serviceContent, version } = content.data;

      if (!serviceId) {
        throw new Error('Service ID missing from delivery message');
      }

      // Store the delivered content
      const serviceContentStorage = ServiceContentStorage.getInstance();
      await serviceContentStorage.storeContent({
        service_id: serviceId,
        agent_id: message.recipient_agent_id,
        content: {
          ...serviceContent,
          private: privateContent // Include decrypted private content
        },
        version,
        tags: ['delivered']
      });

      logger.info(`Service content delivered for service ${serviceId}, version ${version}`);
    }
  }

  private async handlePaymentMessage(message: Message, privateContent: Record<string, any>): Promise<void> {
    // TODO: Implement payment message handling with private content
    logger.info('Payment message received:', { message, privateContent });
  }
} 