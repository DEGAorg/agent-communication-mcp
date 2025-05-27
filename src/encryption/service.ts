import { logger } from '../logger.js';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { createCipheriv, createDecipheriv } from 'crypto';
import { supabase } from '../supabase/config.js';
import { MessagePublic } from '../supabase/message-types.js';
import { KeyManager } from '../utils/key-manager.js';

export class EncryptionService {
  private readonly publicKey: Uint8Array;
  private readonly privateKey: Uint8Array;

  constructor(agentId: string) {
    // Load keys from files using KeyManager
    if (!KeyManager.hasAgentKeys(agentId)) {
      throw new Error(`Agent keys not found. Please run "yarn cli generate-keys <agent-id>" first.`);
    }

    const publicKeyBase64 = KeyManager.getAgentPublicKey(agentId);
    const privateKeyBase64 = KeyManager.getAgentPrivateKey(agentId);

    this.publicKey = Buffer.from(publicKeyBase64, 'base64');
    this.privateKey = Buffer.from(privateKeyBase64, 'base64');
  }

  // Get the agent's public key
  getPublicKey(): Uint8Array {
    return this.publicKey;
  }

  // Get the agent's private key
  getPrivateKey(): Uint8Array {
    return this.privateKey;
  }

  // Generate a random AES-256 key
  private generateAESKey(): Uint8Array {
    return randomBytes(32); // 256 bits
  }

  // Encrypt data with AES-256-GCM
  private encryptAES(data: string, key: Uint8Array): { nonce: string; ciphertext: string; tag: string } {
    const nonce = randomBytes(12); // 96 bits for GCM
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    
    const ciphertext = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final()
    ]);

    return {
      nonce: Buffer.from(nonce).toString('base64'),
      ciphertext: ciphertext.toString('base64'),
      tag: cipher.getAuthTag().toString('base64')
    };
  }

  // Decrypt data with AES-256-GCM
  private decryptAES(encrypted: { nonce: string; ciphertext: string; tag: string }, key: Uint8Array): string {
    try {
      
      const nonce = Buffer.from(encrypted.nonce, 'base64');
      const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
      const tag = Buffer.from(encrypted.tag, 'base64');
  
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(tag);
  
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]).toString('utf8');
    } catch (error) {
      logger.error('Error decrypting message:', error);
      throw error;
    }
  }

  // Encrypt a key with X25519
  private encryptKey(key: Uint8Array, recipientPublicKey: Uint8Array, senderPrivateKey: Uint8Array): string {
    try {
      const sharedSecret = x25519.getSharedSecret(senderPrivateKey, recipientPublicKey);
      logger.debug('Encrypting key with shared secret length:', sharedSecret.length);
      
      const nonce = Buffer.alloc(12, 0);
      const cipher = createCipheriv('aes-256-gcm', sharedSecret.slice(0, 32), nonce);
      
      const encrypted = Buffer.concat([
        cipher.update(key),
        cipher.final()
      ]);
      
      const result = Buffer.concat([
        encrypted,
        cipher.getAuthTag()
      ]).toString('base64');
      
      logger.debug('Encrypted key length:', result.length);
      return result;
    } catch (error) {
      logger.error('Error encrypting key:', error);
      throw error;
    }
  }

  // Decrypt a key with X25519
  private decryptKey(encryptedKey: string, senderPublicKey: Uint8Array, recipientPrivateKey: Uint8Array): Uint8Array {
    try {
      const encrypted = Buffer.from(encryptedKey, 'base64');
      logger.debug('Decrypting key with length:', encrypted.length);
      
      const tag = encrypted.slice(-16);
      const ciphertext = encrypted.slice(0, -16);
      
      const sharedSecret = x25519.getSharedSecret(recipientPrivateKey, senderPublicKey);
      logger.debug('Decrypting with shared secret length:', sharedSecret.length);
      
      const nonce = Buffer.alloc(12, 0);
      const decipher = createDecipheriv('aes-256-gcm', sharedSecret.slice(0, 32), nonce);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      logger.debug('Decrypted key length:', decrypted.length);
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting key:', error);
      throw error;
    }
  }

  // Encrypt message for multiple recipients
  async encryptMessageForRecipients(
    message: string,
    recipientPublicKey: Uint8Array,
    senderPrivateKey: Uint8Array
  ): Promise<{
    encryptedMessage: { nonce: string; ciphertext: string; tag: string };
    encryptedKeys: { recipient: string; auditor: string };
  }> {
    // Generate a random AES key for this message
    const aesKey = this.generateAESKey();
    
    // Encrypt the message with AES
    const encryptedMessage = this.encryptAES(message, aesKey);
    
    // Get auditor's public key from database
    const auditorPublicKey = await this.getAuditorPublicKey();
    
    // Encrypt the AES key for each recipient
    const encryptedKeys = {
      recipient: this.encryptKey(aesKey, recipientPublicKey, senderPrivateKey),
      auditor: this.encryptKey(aesKey, auditorPublicKey, senderPrivateKey)
    };
    
    return {
      encryptedMessage,
      encryptedKeys
    };
  }

  // Get auditor's public key from database
  private async getAuditorPublicKey(): Promise<Uint8Array> {
    const auditorId = '00000000-0000-0000-0000-000000000000';
    const { data: auditor } = await supabase
      .from('agent_public_keys')
      .select('public_key')
      .eq('id', auditorId)
      .single();

    if (!auditor) {
      throw new Error('Auditor public key not found in database');
    }

    return Buffer.from(auditor.public_key, 'base64');
  }

  // Decrypt message using own private key and sender's public key
  async decryptMessage(
    encryptedMessage: { nonce: string; ciphertext: string; tag: string },
    encryptedKey: string,
    senderPublicKey: Uint8Array,
    recipientPrivateKey: Uint8Array
  ): Promise<string> {
    try {
      // First decrypt the AES key
      const aesKey = this.decryptKey(encryptedKey, senderPublicKey, recipientPrivateKey);
      
      // Then decrypt the message
      return this.decryptAES(encryptedMessage, aesKey);
    } catch (error) {
      logger.error('Error decrypting message:', error);
      throw error;
    }
  }

  // Decrypt message and check if it's a MessagePublic
  async decryptMessageAndCheckType(
    encryptedMessage: { nonce: string; ciphertext: string; tag: string },
    encryptedKey: string,
    senderPublicKey: Uint8Array,
    recipientPrivateKey: Uint8Array
  ): Promise<{ isPublicMessage: boolean; publicMessage?: MessagePublic; privateContent?: Record<string, any> }> {
    try {
      const decryptedContent = JSON.parse(
        await this.decryptMessage(encryptedMessage, encryptedKey, senderPublicKey, recipientPrivateKey)
      );

      // Simple validation for MessagePublic structure
      if (
        typeof decryptedContent === 'object' &&
        decryptedContent !== null &&
        'topic' in decryptedContent &&
        'content' in decryptedContent
      ) {
        return {
          isPublicMessage: true,
          publicMessage: decryptedContent as MessagePublic
        };
      }

      // If it's not a valid MessagePublic, throw an error
      throw new Error('Decrypted content does not match MessagePublic structure');
    } catch (error) {
      logger.error('Error decrypting and checking message type:', error);
      throw error;
    }
  }
} 