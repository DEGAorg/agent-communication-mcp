import { Message } from './message-types.js';
import { logger } from '../logger.js';
import { ServiceContentStorage } from '../storage/service-content.js';
import { StateManager } from '../state/manager.js';

export class MessageHandler {
  private static instance: MessageHandler;
  private stateManager: StateManager;

  private constructor() {
    this.stateManager = StateManager.getInstance();
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

      const { public: publicContent } = message;
      const { topic, content } = publicContent;

      switch (topic) {
        case 'delivery':
          await this.handleDeliveryMessage(message);
          break;
        case 'payment':
          await this.handlePaymentMessage(message);
          break;
        default:
          logger.warn(`Unhandled message topic: ${topic}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      throw error;
    }
  }

  private async handleDeliveryMessage(message: Message): Promise<void> {
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
        content: serviceContent,
        version,
        tags: ['delivered']
      });

      logger.info(`Service content delivered for service ${serviceId}, version ${version}`);
    }
  }

  private async handlePaymentMessage(message: Message): Promise<void> {
    // TODO: Implement payment message handling
    logger.info('Payment message received:', message);
  }
} 