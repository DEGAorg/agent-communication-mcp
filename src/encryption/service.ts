import { logger } from '../logger.js';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { createCipheriv, createDecipheriv } from 'crypto';

export class EncryptionService {
  private readonly publicKey: Uint8Array;
  private readonly privateKey: Uint8Array;

  constructor() {
    // Load keys from environment variables
    const publicKeyBase64 = process.env.AGENT_PUBLIC_KEY;
    const privateKeyBase64 = process.env.AGENT_PRIVATE_KEY;

    if (!publicKeyBase64 || !privateKeyBase64) {
      throw new Error('Agent keys not found in environment variables. Please run "yarn cli generate-keys <agent-id>" first.');
    }

    this.publicKey = Buffer.from(publicKeyBase64, 'base64');
    this.privateKey = Buffer.from(privateKeyBase64, 'base64');
  }

  // Get the agent's public key
  getPublicKey(): Uint8Array {
    return this.publicKey;
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
    const sharedSecret = x25519.getSharedSecret(senderPrivateKey, recipientPublicKey);
    const nonce = Buffer.alloc(12, 0); // Use zero-filled nonce for key encryption
    const cipher = createCipheriv('aes-256-gcm', sharedSecret, nonce);
    const encrypted = Buffer.concat([
      cipher.update(key),
      cipher.final()
    ]);
    return Buffer.concat([
      encrypted,
      cipher.getAuthTag()
    ]).toString('base64');
  }

  // Decrypt a key with X25519
  private decryptKey(encryptedKey: string, senderPublicKey: Uint8Array, recipientPrivateKey: Uint8Array): Uint8Array {
    try {
      const encrypted = Buffer.from(encryptedKey, 'base64');
      const tag = encrypted.slice(-16);
      const ciphertext = encrypted.slice(0, -16);
      
      const sharedSecret = x25519.getSharedSecret(recipientPrivateKey, senderPublicKey);
      const nonce = Buffer.alloc(12, 0); // Use same zero-filled nonce as encryption
      const decipher = createDecipheriv('aes-256-gcm', sharedSecret, nonce);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
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
    auditorPublicKey: Uint8Array,
    senderPrivateKey: Uint8Array
  ): Promise<{
    encryptedMessage: { nonce: string; ciphertext: string; tag: string };
    encryptedKeys: { recipient: string; auditor: string };
  }> {
    // Generate a random AES key for this message
    const aesKey = this.generateAESKey();
    
    // Encrypt the message with AES
    const encryptedMessage = this.encryptAES(message, aesKey);
    
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
} 