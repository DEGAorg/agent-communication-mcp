import { Message, MESSAGE_TOPICS, CONTENT_TYPES, TRANSACTION_TYPES, MESSAGE_STATUS, hasEncryptedContent } from './message-types.js';
import { logger } from '../logger.js';
import { ServiceContentStorage } from '../storage/service-content.js';
import { StateManager } from '../state/manager.js';
import { EncryptionService } from '../encryption/service.js';
import { AuthService } from './auth.js';
import { SupabaseService } from './service.js';
import { createServiceDeliveryMessage } from './message-helper.js';
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

  private async verifyProof(message: Message): Promise<boolean> {
    if (!message.proof) {
      // If no proof is provided but there's private content, reject
      if (message.private.encryptedMessage) {
        throw new Error('Private content provided without ZK proof');
      }
      return true;
    }

    try {
      const verificationKey = JSON.parse(
        await fs.promises.readFile('src/zk/proofs/encryption_proof_verification_key.json', 'utf8')
      );
      
      return await groth16.verify(
        verificationKey,
        message.proof.publicSignals,
        message.proof.proof
      );
    } catch (error) {
      logger.error('Error verifying ZK proof:', error);
      throw new Error('Failed to verify ZK proof');
    }
  }

  async handleMessage(message: Message): Promise<void> {
    try {
      this.ensureServicesInitialized();

      // Ensure system is ready before handling any messages
      await this.stateManager!.ensureReadyWithRecovery();

      const { public: publicContent, private: privateContent } = message;
      const { topic, content } = publicContent;

      // Decrypt private content if it exists
      let decryptedPrivateContent: Record<string, any> = {};
      if (hasEncryptedContent(message)) {
        const recipientPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
        
        // Get sender's public key from database
        const senderPublicKeyBase64 = await this.supabaseService!.getAgentPublicKey(message.sender_agent_id);
        if (!senderPublicKeyBase64) {
          throw new Error(`Sender agent ${message.sender_agent_id} not found or has no public key`);
        }
        const senderPublicKey = Buffer.from(senderPublicKeyBase64, 'base64');
        
        decryptedPrivateContent = JSON.parse(
          await this.encryptionService!.decryptMessage(
            message.private.encryptedMessage,
            message.private.encryptedKeys.recipient,
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

      // Verify ZK proof if there's private content
      if (hasEncryptedContent(message)) {
        const isValid = await this.verifyProof(message);
        if (!isValid) {
          throw new Error('Invalid ZK proof for private content');
        }
      }

      // Combine public and private content based on privacy settings
      const combinedContent = {
        ...content.data,
        // Include private content if it exists and privacy settings allow
        ...(privateContent.content && service.privacy_settings.privacy === 'private' ? {
          content: privateContent.content
        } : {}),
        // Include conditions if they exist and privacy settings allow
        ...(privateContent.conditions && service.privacy_settings.conditions.privacy === 'private' ? {
          conditions: privateContent.conditions
        } : {})
      };

      // If content is encrypted, decrypt it
      let decryptedContent = combinedContent;
      if (hasEncryptedContent(message)) {
        try {
          const recipientPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
          const senderPublicKeyBase64 = await this.supabaseService!.getAgentPublicKey(message.sender_agent_id);
          if (!senderPublicKeyBase64) {
            throw new Error(`Sender agent ${message.sender_agent_id} not found or has no public key`);
          }
          const senderPublicKey = Buffer.from(senderPublicKeyBase64, 'base64');
          
          // Since we've checked hasEncryptedContent, we know these fields exist
          const { encryptedMessage, encryptedKeys } = message.private;
          decryptedContent = JSON.parse(
            await this.encryptionService!.decryptMessage(
              encryptedMessage,
              encryptedKeys.recipient,
              senderPublicKey,
              recipientPrivateKey
            )
          );
        } catch (error) {
          logger.error('Error decrypting delivery message:', error);
          throw new Error('Failed to decrypt delivery message');
        }
      }

      // Store the received content for the recipient
      await this.receivedContentStorage!.storeContent({
        payment_message_id: message.parent_message_id!,
        service_id: serviceId,
        content: decryptedContent,
        version,
        tags: ['received']
      });

      // Mark message as read after successful processing
      await this.supabaseService!.markMessageAsRead(message.id);

      logger.info(`Service content received and stored for service ${serviceId}, version ${version}`);
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

      // Verify ZK proof if there's private content
      if (hasEncryptedContent(message)) {
        const isValid = await this.verifyProof(message);
        if (!isValid) {
          throw new Error('Invalid ZK proof for private content');
        }
      }

      // Combine public and private content based on privacy settings
      const combinedContent = {
        ...content.data,
        // Include private payment details if they exist and privacy settings allow
        ...(privateContent.amount && service.privacy_settings.privacy === 'private' ? {
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
      
      // Mark payment message as read after successful processing and delivery message sent
      await this.supabaseService!.markMessageAsRead(message.id);

      logger.info(`Service delivery triggered automatically after payment for service ${serviceId}`, {
        conversation_id: message.conversation_id,
        parent_message_id: message.id
      });
    }
  }
} 