import { Message, MESSAGE_TOPICS, CONTENT_TYPES, MESSAGE_STATUS, hasEncryptedContent, hasPublicContent, hasPrivateContent, MessageTopic, MessageContent, MessagePublic, EncryptedMessage } from './message-types.js';
import { logger } from '../logger.js';
import { ServiceContentStorage } from '../storage/service-content.js';
import { StateManager } from '../state/manager.js';
import { EncryptionService } from '../encryption/service.js';
import { AuthService } from './auth.js';
import { SupabaseService } from './service.js';
import { createServiceDeliveryMessage, verifyProof } from './message-helper.js';
import { ReceivedContentStorage } from '../storage/received-content.js';
import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import fs from 'fs';
import { AppError } from '../errors/AppError.js';
import { verifyTransaction } from '../api/wallet-api.js';

export class MessageHandler {
  private static instance: MessageHandler;
  private stateManager: StateManager | null = null;
  private encryptionService: EncryptionService | null = null;
  private authService: AuthService | null = null;
  private supabaseService: SupabaseService | null = null;
  private receivedContentStorage: ReceivedContentStorage | null = null;

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

  setReceivedContentStorage(receivedContentStorage: ReceivedContentStorage) {
    this.receivedContentStorage = receivedContentStorage;
  }

  private ensureServicesInitialized(): void {
    if (!this.stateManager || !this.encryptionService || !this.authService || !this.supabaseService || !this.receivedContentStorage) {
      throw new Error('Required services not initialized');
    }
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      this.ensureServicesInitialized();

      // Ensure system is ready before handling any messages
      await this.stateManager!.ensureReadyWithRecovery();

      // Decrypt private content if it exists
      let decryptedPublicContent: MessagePublic | undefined;

      if (hasPrivateContent(message) && hasEncryptedContent(message)) {
        // Get sender's public key from database
        const senderPublicKeyBase64 = await this.supabaseService!.getAgentPublicKey(message.sender_agent_id);
        if (!senderPublicKeyBase64) {
          throw new Error(`Sender agent ${message.sender_agent_id} not found or has no public key`);
        }
        const senderPublicKey = Buffer.from(senderPublicKeyBase64, 'base64');
        
        const { publicMessage } = await this.encryptionService!.decryptMessageAndCheckType(
          message.private.encryptedMessage!,
          message.private.encryptedKeys!.recipient,
          senderPublicKey,
          this.encryptionService!.getPrivateKey()
        );

        decryptedPublicContent = publicMessage;
      }

      // Get topic from either public or decrypted private content
      let topic: MessageTopic;

      if (hasPublicContent(message)) {
        topic = message.public.topic;
      } else if (decryptedPublicContent) {
        topic = decryptedPublicContent.topic;
      } else {
        throw new Error('Message must have either public content or encrypted private content with topic');
      }

      switch (topic) {
        case MESSAGE_TOPICS.DELIVERY:
          await this.handleDeliveryMessage(message as Message & { private: EncryptedMessage }, decryptedPublicContent);
          break;
        case MESSAGE_TOPICS.PAYMENT:
          await this.handlePaymentMessage(message as Message & { private: EncryptedMessage }, decryptedPublicContent);
          break;
        case MESSAGE_TOPICS.FEEDBACK:
          // Mark feedback message as read
          await this.supabaseService!.markMessageAsRead(message.id!);
          logger.info(`Feedback message marked as read: ${message.id}`);
          break;
        default:
          logger.warn(`Unhandled message topic: ${topic}`);
      }
    } catch (error) {
      logger.error({
        msg: `Error handling message ${message.id}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          messageId: message.id,
          timestamp: new Date().toISOString()
        }
      });
      throw error;
    }
  }

  private async handleDeliveryMessage(message: Message & { private: EncryptedMessage }, decryptedContent?: MessagePublic): Promise<void> {
    const serviceId = message.public?.serviceId || decryptedContent?.serviceId;

    if (!serviceId) {
      throw new Error('Service ID missing from delivery message');
    }

    // Get service details
    const service = await this.supabaseService!.getServiceById(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // Verify ZK proof if there's private content
    if (hasEncryptedContent(message)) {
      const isValid = await verifyProof(message);
      if (!isValid) {
        throw new Error('Invalid ZK proof for private content');
      }
    }

    // Validate and get content data
    const contentData = message.public?.content?.data || decryptedContent?.content?.data;
    if (!contentData) {
      throw new Error('No valid content data found in message');
    }

    // Get and validate version
    const version = message.public?.content?.metadata?.version || decryptedContent?.content?.metadata?.version;
    if (!version) {
      throw new Error('No valid version found in message content metadata');
    }

    // Store the received content for the recipient
    await this.receivedContentStorage!.storeContent({
      payment_message_id: message.parent_message_id!,
      service_id: serviceId,
      agent_id: message.recipient_agent_id,
      content: contentData,
      version
    });

    // Mark message as read after successful processing
    await this.supabaseService!.markMessageAsRead(message.id!);

    logger.info(`Service content received and stored for service ${serviceId}`);
  }

  private async handlePaymentMessage(message: Message & { private: EncryptedMessage }, decryptedContent?: MessagePublic): Promise<void> {
    const serviceId = message.public?.serviceId || decryptedContent?.serviceId;

    if (!serviceId) {
      throw new Error('Service ID missing from payment message');
    }

    // Get service details
    const service = await this.supabaseService!.getServiceById(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // Verify ZK proof if there's private content
    if (hasEncryptedContent(message)) {
      const isValid = await verifyProof(message);
      if (!isValid) {
        throw new Error('Invalid ZK proof for private content');
      }
    }

    // Read transaction identifier from the payment message and call validator
    const data = message.public?.content?.data || decryptedContent?.content?.data;
    const transactionIdentifier = data?.transaction_id;
    if (!transactionIdentifier || !data?.amount) {
      throw new Error('No transaction identifier or amount found in payment message');
    }

    // Start transaction verification process in background
    this.verifyTransactionWithRetry(message, transactionIdentifier, data.amount, service)
      .catch(error => {
        logger.error('Error in background transaction verification', {
          error,
          transactionId: transactionIdentifier,
          messageId: message.id
        });
      });

    logger.info(`Payment message received and verification started for transaction ${transactionIdentifier}`);
  }

  private async verifyTransactionWithRetry(
    message: Message & { private: EncryptedMessage },
    transactionIdentifier: string,
    amount: string,
    service: any
  ): Promise<void> {
    const MAX_RETRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
    const RETRY_INTERVAL = 10 * 1000; // 10 seconds in milliseconds
    const startTime = Date.now();
    let isTxValid = false;

    while (Date.now() - startTime < MAX_RETRY_TIME) {
      isTxValid = await verifyTransaction(transactionIdentifier, amount);
      if (isTxValid) {
        break;
      }
      
      logger.info(`Transaction ${transactionIdentifier} not yet valid, retrying in ${RETRY_INTERVAL/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    }

    if (!isTxValid) {
      logger.error(`Transaction ${transactionIdentifier} not valid after ${MAX_RETRY_TIME/1000/60} minutes of retrying`);
      return;
    }

    try {
      // Get the stored service content
      const serviceContentStorage = ServiceContentStorage.getInstance();
      const serviceContent = await serviceContentStorage.getContent(service.agent_id, service.id);
      
      if (!serviceContent) {
        throw new Error(`No content found for service ${service.id}`);
      }

      // Create and send the delivery message
      const deliveryMessage = await createServiceDeliveryMessage(
        service.agent_id,
        message.sender_agent_id,
        service.id,
        serviceContent.content,
        serviceContent.version,
        service.name,
        service.privacy_settings,
        message.id,
        message.conversation_id
      );

      await this.supabaseService!.sendMessage(deliveryMessage);
      
      // Only mark as read after successful delivery
      await this.supabaseService!.markMessageAsRead(message.id!);
      
      logger.info(`Service delivery triggered after successful payment verification for service ${service.id}`, {
        conversation_id: message.conversation_id,
        parent_message_id: message.id
      });
    } catch (error) {
      logger.error('Error processing delivery after transaction verification', {
        error,
        transactionId: transactionIdentifier,
        messageId: message.id
      });
      // Don't mark as read if there was an error
      throw error;
    }
  }
}