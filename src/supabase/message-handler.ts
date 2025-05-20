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
        const recipientPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
        
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
          recipientPrivateKey
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
        default:
          logger.warn(`Unhandled message topic: ${topic}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
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
      content: contentData,
      version,
      tags: ['received']
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
    
    // Mark payment message as read after successful processing and delivery message sent
    await this.supabaseService!.markMessageAsRead(message.id!);

    logger.info(`Service delivery triggered automatically after payment for service ${serviceId}`, {
      conversation_id: message.conversation_id,
      parent_message_id: message.id
    });
  }
} 