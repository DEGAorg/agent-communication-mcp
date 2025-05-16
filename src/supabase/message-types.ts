export const MESSAGE_TOPICS = {
  SERVICE: 'service',
  NOTIFICATION: 'notification',
  PAYMENT: 'payment',
  DELIVERY: 'delivery'
} as const;

export const CONTENT_TYPES = {
  TEXT: 'text',
  JSON: 'json',
  TRANSACTION: 'transaction',
  IMAGE: 'image'
} as const;

export const TRANSACTION_TYPES = {
  PAYMENT_NOTIFICATION: 'payment_notification',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  SERVICE_DELIVERY: 'service_delivery'
} as const;

export const MESSAGE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export const MESSAGE_PURPOSE = {
  PAYMENT_NOTIFICATION: 'payment_notification',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  SERVICE_DELIVERY: 'service_delivery',
  SERVICE_REQUEST: 'service_request'
} as const;

export const SERVICE_PRIVACY_LEVELS = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  MIXED: 'mixed'
} as const;

export type MessageTopic = typeof MESSAGE_TOPICS[keyof typeof MESSAGE_TOPICS];
export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];
export type TransactionType = typeof TRANSACTION_TYPES[keyof typeof TRANSACTION_TYPES];
export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];
export type MessagePurpose = typeof MESSAGE_PURPOSE[keyof typeof MESSAGE_PURPOSE];
export type ServicePrivacyLevel = typeof SERVICE_PRIVACY_LEVELS[keyof typeof SERVICE_PRIVACY_LEVELS];

// Message type definitions
export interface MessageMetadata {
  timestamp: string;
  version: string;
  extra?: {
    purpose?: MessagePurpose;
    [key: string]: any;
  };
}

export interface MessageContent<T = any> {
  type: ContentType;
  data: T;
  metadata: MessageMetadata;
}

export interface MessagePublic {
  topic: MessageTopic;
  serviceId?: string;
  content: MessageContent;
}

export interface EncryptedMessage {
  encryptedMessage: {
    nonce: string;
    ciphertext: string;
    tag: string;
  };
  encryptedKeys: {
    recipient: string;
    auditor: string;
  };
}

export interface Message {
  id: string;
  sender_agent_id: string;
  recipient_agent_id: string;
  public: MessagePublic;
  private: EncryptedMessage;
  conversation_id: string;
  parent_message_id?: string;
}

export interface ServicePrivacySettings {
  contentPrivacy: ServicePrivacyLevel;
  paymentPrivacy: ServicePrivacyLevel;
  deliveryPrivacy: ServicePrivacyLevel;
  conditions: {
    text: string;
    privacy: ServicePrivacyLevel;
  };
}

export interface ClientPrivacyPreferences {
  contentPrivacy: ServicePrivacyLevel;
  paymentPrivacy: ServicePrivacyLevel;
  deliveryPrivacy: ServicePrivacyLevel;
}

// Type guard functions
export function isValidMessageTopic(topic: string): topic is MessageTopic {
  return Object.values(MESSAGE_TOPICS).includes(topic as MessageTopic);
}

export function isValidContentType(type: string): type is ContentType {
  return Object.values(CONTENT_TYPES).includes(type as ContentType);
}

export function isValidTransactionType(type: string): type is TransactionType {
  return Object.values(TRANSACTION_TYPES).includes(type as TransactionType);
}

export function isValidMessageStatus(status: string): status is MessageStatus {
  return Object.values(MESSAGE_STATUS).includes(status as MessageStatus);
}

export function isValidMessagePurpose(purpose: string): purpose is MessagePurpose {
  return Object.values(MESSAGE_PURPOSE).includes(purpose as MessagePurpose);
} 