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
  MessageCreate,
  SERVICE_PRIVACY_LEVELS
} from './message-types.js';
import { EncryptionService } from '../encryption/service.js';
import { SupabaseService } from './service.js';
import crypto from 'crypto';
import { groth16 } from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to resolve ZK file paths
function resolveZKFilePath(filename: string): string {
  // First check if a custom path is set in environment
  const customPath = process.env.ZK_FILES_PATH;
  if (customPath) {
    const customFilePath = path.join(customPath, filename);
    if (fs.existsSync(customFilePath)) {
      return customFilePath;
    }
    logger.warn(`Custom ZK file path ${customFilePath} not found, falling back to default location`);
  }

  // Try to find the file in the source directory
  const sourcePath = path.join(__dirname, '..', '..', 'src', 'zk', 'proofs', filename);
  if (fs.existsSync(sourcePath)) {
    return sourcePath;
  }

  // Try to find the file in the build directory
  const buildPath = path.join(__dirname, '..', 'zk', 'proofs', filename);
  if (fs.existsSync(buildPath)) {
    return buildPath;
  }

  throw new Error(`Could not find ZK file ${filename} in any of the expected locations`);
}

// Helper function to hash 32 elements exactly as in the circuit
async function hash32Array(poseidon: any, arr: string[]): Promise<string> {
    const chunk1 = arr.slice(0, 11);
    const chunk2 = arr.slice(11, 22);
    const chunk3 = arr.slice(22, 32);

    const chunk1BigInt = chunk1.map(x => BigInt(x));
    const chunk2BigInt = chunk2.map(x => BigInt(x));
    const chunk3BigInt = chunk3.map(x => BigInt(x));

    const hash1 = poseidon.F.toObject(poseidon(chunk1BigInt));
    const hash2 = poseidon.F.toObject(poseidon(chunk2BigInt));
    const hash3 = poseidon.F.toObject(poseidon(chunk3BigInt));

    const finalHash = poseidon.F.toObject(poseidon([hash1, hash2, hash3]));
    return finalHash.toString();
}

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
  privateContent: Record<string, any> = {},
  parentMessageId?: string,
  conversationId?: string
): Promise<MessageCreate> {
  const encryptionService = new EncryptionService();
  const supabaseService = SupabaseService.getInstance();
  
  // If there's no private content, return message without encryption
  if (Object.keys(privateContent).length === 0) {
    return {
      sender_agent_id: senderId,
      recipient_agent_id: recipientId,
      public: publicContent,
      private: {},
      parent_message_id: parentMessageId,
      conversation_id: conversationId || crypto.randomUUID(),
      proof: undefined
    };
  }

  // Get the sender's private key and recipient's public key
  const senderPrivateKey = Buffer.from(process.env.AGENT_PRIVATE_KEY!, 'base64');
  
  // Get recipient's public key from database
  const recipientPublicKeyBase64 = await supabaseService.getAgentPublicKey(recipientId);
  if (!recipientPublicKeyBase64) {
    throw new Error(`Recipient agent ${recipientId} not found or has no public key`);
  }
  const recipientPublicKey = Buffer.from(recipientPublicKeyBase64, 'base64');
  
  // Encrypt the private content
  const { encryptedMessage, encryptedKeys } = await encryptionService.encryptMessageForRecipients(
    JSON.stringify(privateContent),
    recipientPublicKey,
    senderPrivateKey
  );

  // Generate a new conversation ID if none is provided
  const finalConversationId = conversationId || crypto.randomUUID();

  // Generate ZK proof if this is a private message
  let proof = undefined;
  if (Object.keys(privateContent).length > 0) {
    try {
      // Initialize Poseidon hash function
      const poseidon = await buildPoseidon();

      // Convert keys to arrays of 32 elements
      const aesKey = Array.from({ length: 32 }, (_, i) => 
        i < encryptedKeys.recipient.length ? encryptedKeys.recipient[i] : '0'
      );
      const pubKeyB = Array.from({ length: 32 }, (_, i) => 
        i < recipientPublicKey.length ? recipientPublicKey[i].toString() : '0'
      );
      const pubKeyAuditor = Array.from({ length: 32 }, (_, i) => 
        i < process.env.AUDITOR_PUBLIC_KEY!.length ? process.env.AUDITOR_PUBLIC_KEY![i] : '0'
      );

      // Hash the keys using the circuit's exact method
      const hashKey = await hash32Array(poseidon, aesKey);
      const hashPubB = await hash32Array(poseidon, pubKeyB);
      const hashPubAuditor = await hash32Array(poseidon, pubKeyAuditor);

      // Combine hashes to get final encrypted keys
      const encKeyForB = poseidon.F.toObject(poseidon([BigInt(hashKey), BigInt(hashPubB)]));
      const encKeyForAuditor = poseidon.F.toObject(poseidon([BigInt(hashKey), BigInt(hashPubAuditor)]));

      // Input values for the circuit
      const input = {
        pubKeyB: pubKeyB.map(x => x.toString()),
        pubKeyAuditor: pubKeyAuditor.map(x => x.toString()),
        encKeyForB: encKeyForB.toString(),
        encKeyForAuditor: encKeyForAuditor.toString(),
        aesKey: aesKey.map(x => x.toString())
      };

      // Check if ZK circuit files exist
      const wasmPath = resolveZKFilePath('encryption_proof.wasm');
      const zkeyPath = resolveZKFilePath('encryption_proof_final.zkey');
      
      logger.debug({
        msg: 'Using ZK circuit files',
        wasmPath,
        zkeyPath
      });

      // Generate proof
      const { proof: zkProof, publicSignals } = await groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
      );

      proof = {
        proof: zkProof,
        publicSignals
      };
    } catch (error) {
      logger.error({
        msg: 'Error generating ZK proof',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
        context: {
          operation: 'zk_proof_generation',
          timestamp: new Date().toISOString()
        }
      });
      throw new Error(`Failed to generate ZK proof for private message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    sender_agent_id: senderId,
    recipient_agent_id: recipientId,
    public: publicContent,
    private: {
      encryptedMessage,
      encryptedKeys
    },
    parent_message_id: parentMessageId,
    conversation_id: finalConversationId,
    proof
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
): Promise<MessageCreate> {
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
    // Only handle amount privacy, everything else is public
    amount: privacySettings?.privacy === 'private' ? undefined : baseContent.amount
  };

  const privateData = {
    // Only include amount in private data if privacy is set to private
    amount: privacySettings?.privacy === 'private' ? baseContent.amount : undefined
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
  privacySettings: ServicePrivacySettings,
  parentMessageId?: string,
  conversationId?: string
): Promise<MessageCreate> {
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
  if (privacySettings.privacy === 'private') {
    privateData.content = serviceContent;
  } else {
    // For public privacy, add content to public data
    publicData.content = serviceContent;
  }

  // Add conditions to private data if privacy settings require it
  if (privacySettings.conditions.privacy === 'private') {
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

  return await createMessage(
    senderId,
    recipientId,
    publicContent,
    privateContent,
    parentMessageId,
    conversationId
  );
} 