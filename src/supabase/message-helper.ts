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
  ServicePrivacySettings,
} from './message-types.js';
import { EncryptionService } from '../encryption/service.js';
import { SupabaseService } from './service.js';

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
  const supabaseService = SupabaseService.getInstance();
  
  // Get the sender's private key and recipient's public key
  const senderPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
  
  // Get recipient's public key from database
  const recipient = await supabaseService.getAgent(recipientId);
  if (!recipient) {
    throw new Error(`Recipient agent ${recipientId} not found`);
  }
  const recipientPublicKey = Buffer.from(recipient.public_key, 'base64');
  
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
  serviceName: string,
  transactionId: string,
  privacySettings?: ServicePrivacySettings
): Promise<Message> {
  // Create base content
  const baseContent = {
    type: TRANSACTION_TYPES.PAYMENT_NOTIFICATION,
    amount,
    status: MESSAGE_STATUS.PENDING,
    service_name: serviceName,
    timestamp: new Date().toISOString(),
    transaction_id: transactionId
  };

  // Determine what goes in public vs private based on privacy settings
  const publicData = {
    ...baseContent,
    // Always public
    status: baseContent.status,
    service_name: baseContent.service_name,
    timestamp: baseContent.timestamp,
    transaction_id: baseContent.transaction_id
  };

  const privateData = {
    // Private data based on privacy settings
    amount: privacySettings?.paymentPrivacy === 'private' ? amount : undefined,
    // Add any other private payment details here
  };

  const content = createMessageContent(
    CONTENT_TYPES.TRANSACTION,
    publicData,
    MESSAGE_PURPOSE.PAYMENT_NOTIFICATION
  );

  const publicContent = createMessagePublic(
    MESSAGE_TOPICS.PAYMENT,
    content,
    serviceId
  );

  // Only include private content if there's something to encrypt
  const privateContent = Object.values(privateData).some(v => v !== undefined) ? privateData : {};

  return await createMessage(senderId, recipientId, publicContent, privateContent);
}

// Add a new function for creating service delivery messages
export async function createServiceDeliveryMessage(
  senderId: string,
  recipientId: string,
  serviceId: string,
  serviceContent: any,
  version: string,
  serviceName: string,
  privacySettings: ServicePrivacySettings
): Promise<Message> {
  // Create base content that is always public
  const publicData: {
    type: typeof TRANSACTION_TYPES.SERVICE_DELIVERY;
    status: typeof MESSAGE_STATUS.COMPLETED;
    service_name: string;
    version: string;
    timestamp: string;
    content?: any;
    conditions?: string;
  } = {
    type: TRANSACTION_TYPES.SERVICE_DELIVERY,
    status: MESSAGE_STATUS.COMPLETED,
    service_name: serviceName,
    version,
    timestamp: new Date().toISOString()
  };

  // Create private data based on privacy settings
  const privateData: Record<string, any> = {};
  
  // Add service content to private data if privacy settings require it
  if (privacySettings.deliveryPrivacy === 'private') {
    privateData.content = serviceContent;
  } else if (privacySettings.deliveryPrivacy === 'mixed') {
    // For mixed privacy, we could implement a more sophisticated content filtering
    // For now, we'll treat it as private
    privateData.content = serviceContent;
  } else {
    // For public privacy, add content to public data
    publicData.content = serviceContent;
  }

  // Add conditions to private data if privacy settings require it
  if (privacySettings.conditions.privacy === 'private') {
    privateData.conditions = privacySettings.conditions.text;
  } else if (privacySettings.conditions.privacy === 'mixed') {
    // For mixed privacy, we could implement a more sophisticated content filtering
    // For now, we'll treat it as private
    privateData.conditions = privacySettings.conditions.text;
  } else {
    // For public privacy, add conditions to public data
    publicData.conditions = privacySettings.conditions.text;
  }

  // Create the message content
  const content = createMessageContent(
    CONTENT_TYPES.TRANSACTION,
    publicData,
    MESSAGE_PURPOSE.SERVICE_DELIVERY
  );

  // Create the public content
  const publicContent = createMessagePublic(
    MESSAGE_TOPICS.DELIVERY,
    content,
    serviceId
  );

  // Only include private content if there's something to encrypt
  const privateContent = Object.keys(privateData).length > 0 ? privateData : {};

  return await createMessage(senderId, recipientId, publicContent, privateContent);
} 