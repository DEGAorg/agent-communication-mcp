import { 
  Message, 
  MessageContent, 
  MessagePublic,
  MESSAGE_TOPICS, 
  CONTENT_TYPES, 
  TRANSACTION_TYPES,
  MESSAGE_STATUS,
  MESSAGE_PURPOSE,
  MessagePurpose,
} from './message-types.js';
import { EncryptionService } from '../encryption/service.js';

export function createMessageMetadata(purpose?: MessagePurpose): Message['public']['content']['metadata'] {
  return {
    timestamp: new Date().toISOString(),
    version: '1.0',
    extra: purpose ? { purpose } : undefined
  };
}

export function createMessageContent<T>(
  type: Message['public']['content']['type'],
  data: T,
  purpose?: MessagePurpose
): MessageContent<T> {
  return {
    type,
    data,
    metadata: createMessageMetadata(purpose)
  };
}

export function createMessagePublic(
  topic: Message['public']['topic'],
  content: MessageContent,
  serviceId?: string
): MessagePublic {
  return {
    topic,
    serviceId,
    content
  };
}

export async function createMessage(
  senderId: string,
  recipientId: string,
  publicContent: MessagePublic,
  privateContent: Record<string, any> = {}
): Promise<Message> {
  const encryptionService = new EncryptionService();
  
  // Get the sender's private key and recipient's public key
  const senderPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
  const recipientPublicKey = Buffer.from(process.env.AGENT_PUBLIC_KEY!, 'base64');
  
  // Encrypt the private content
  const { encryptedMessage, encryptedKeys } = await encryptionService.encryptMessageForRecipients(
    JSON.stringify(privateContent),
    recipientPublicKey,
    recipientPublicKey, // For now, we're using the same key for auditor
    senderPrivateKey
  );

  return {
    sender_agent_id: senderId,
    recipient_agent_id: recipientId,
    public: publicContent,
    private: {
      encryptedMessage,
      encryptedKeys
    }
  };
}

// Specific message creators
export async function createPaymentNotificationMessage(
  senderId: string,
  recipientId: string,
  serviceId: string,
  amount: string,
  serviceName: string
): Promise<Message> {
  const content = createMessageContent(
    CONTENT_TYPES.TRANSACTION,
    {
      type: TRANSACTION_TYPES.PAYMENT_NOTIFICATION,
      amount,
      status: MESSAGE_STATUS.PENDING,
      service_name: serviceName,
      timestamp: new Date().toISOString()
    },
    MESSAGE_PURPOSE.PAYMENT_NOTIFICATION
  );

  const publicContent = createMessagePublic(
    MESSAGE_TOPICS.PAYMENT,
    content,
    serviceId
  );

  return await createMessage(senderId, recipientId, publicContent);
} 