import { jest, describe, it, expect, beforeAll } from '@jest/globals';
import { EncryptionService } from '../src/encryption/service.js';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import { KeyManager } from '../src/utils/key-manager.js';

// Mock the KeyManager
jest.mock('../src/utils/key-manager.js', () => ({
  KeyManager: {
    hasAgentKeys: jest.fn(),
    getAgentPublicKey: jest.fn(),
    getAgentPrivateKey: jest.fn()
  }
}));

// Mock the supabase module
jest.mock('../src/supabase/config.js', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let testPublicKey: Uint8Array;
  let testPrivateKey: Uint8Array;
  let recipientPublicKey: Uint8Array;
  let recipientPrivateKey: Uint8Array;
  let auditorPublicKey: Uint8Array;
  let auditorPrivateKey: Uint8Array;
  const testAgentId = 'test-agent-id';

  beforeAll(() => {
    // Generate test keys
    testPrivateKey = randomBytes(32);
    testPublicKey = x25519.getPublicKey(testPrivateKey);
    
    recipientPrivateKey = randomBytes(32);
    recipientPublicKey = x25519.getPublicKey(recipientPrivateKey);
    
    auditorPrivateKey = randomBytes(32);
    auditorPublicKey = x25519.getPublicKey(auditorPrivateKey);

    // Set up environment variables for the service
    process.env.AGENT_PUBLIC_KEY = Buffer.from(testPublicKey).toString('base64');
    process.env.AGENT_PRIVATE_KEY = Buffer.from(testPrivateKey).toString('base64');

    // Properly mock static methods
    jest.spyOn(KeyManager, 'hasAgentKeys').mockReturnValue(true);
    jest.spyOn(KeyManager, 'getAgentPublicKey').mockReturnValue(Buffer.from(testPublicKey).toString('base64'));
    jest.spyOn(KeyManager, 'getAgentPrivateKey').mockReturnValue(Buffer.from(testPrivateKey).toString('base64'));

    encryptionService = new EncryptionService(testAgentId);
  });

  describe('getPublicKey', () => {
    it('should return the correct public key', () => {
      const publicKey = encryptionService.getPublicKey();
      expect(Buffer.from(publicKey).toString('base64')).toBe(
        Buffer.from(testPublicKey).toString('base64')
      );
    });
  });

  describe('getPrivateKey', () => {
    it('should return the correct private key', () => {
      const privateKey = encryptionService.getPrivateKey();
      expect(Buffer.from(privateKey).toString('base64')).toBe(
        Buffer.from(testPrivateKey).toString('base64')
      );
    });
  });

  describe('AES encryption and decryption', () => {
    it('should encrypt and decrypt a message correctly', () => {
      const message = 'Test message for AES encryption';
      const aesKey = randomBytes(32);
      
      // Test the private encryptAES method through reflection
      const encryptAES = (encryptionService as any).encryptAES.bind(encryptionService);
      const decryptAES = (encryptionService as any).decryptAES.bind(encryptionService);
      
      const encrypted = encryptAES(message, aesKey);
      const decrypted = decryptAES(encrypted, aesKey);
      
      expect(decrypted).toBe(message);
      expect(encrypted).toHaveProperty('nonce');
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('tag');
    });

    it('should fail to decrypt with wrong key', () => {
      const message = 'Test message for AES encryption';
      const aesKey = randomBytes(32);
      const wrongKey = randomBytes(32);
      
      const encryptAES = (encryptionService as any).encryptAES.bind(encryptionService);
      const decryptAES = (encryptionService as any).decryptAES.bind(encryptionService);
      
      const encrypted = encryptAES(message, aesKey);
      
      expect(() => {
        decryptAES(encrypted, wrongKey);
      }).toThrow();
    });
  });

  describe('X25519 key encryption and decryption', () => {
    it('should encrypt and decrypt a key correctly', () => {
      const key = randomBytes(32);
      
      const encryptKey = (encryptionService as any).encryptKey.bind(encryptionService);
      const decryptKey = (encryptionService as any).decryptKey.bind(encryptionService);
      
      const encryptedKey = encryptKey(key, recipientPublicKey, testPrivateKey);
      const decryptedKey = decryptKey(encryptedKey, testPublicKey, recipientPrivateKey);
      
      expect(Buffer.from(decryptedKey)).toEqual(Buffer.from(key));
    });

    it('should fail to decrypt with wrong private key', () => {
      const key = randomBytes(32);
      const wrongPrivateKey = randomBytes(32);
      
      const encryptKey = (encryptionService as any).encryptKey.bind(encryptionService);
      const decryptKey = (encryptionService as any).decryptKey.bind(encryptionService);
      
      const encryptedKey = encryptKey(key, recipientPublicKey, testPrivateKey);
      
      expect(() => {
        decryptKey(encryptedKey, testPublicKey, wrongPrivateKey);
      }).toThrow();
    });
  });

  describe('Message encryption and decryption', () => {
    it('should encrypt and decrypt a message correctly', async () => {
      const message = 'Test message for encryption';
      
      // Mock the getAuditorPublicKey method to return our test auditor key
      jest.spyOn(encryptionService as any, 'getAuditorPublicKey').mockResolvedValue(auditorPublicKey);
      
      const result = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        testPrivateKey
      );

      // Verify the structure of the encrypted message
      expect(result.encryptedMessage).toHaveProperty('nonce');
      expect(result.encryptedMessage).toHaveProperty('ciphertext');
      expect(result.encryptedMessage).toHaveProperty('tag');
      
      // Verify the structure of encrypted keys
      expect(result.encryptedKeys).toHaveProperty('recipient');
      expect(result.encryptedKeys).toHaveProperty('auditor');
      
      // Verify the encrypted message is different from the original
      expect(result.encryptedMessage.ciphertext).not.toBe(message);

      // Decrypt the message as the recipient
      const decryptedMessage = await encryptionService.decryptMessage(
        result.encryptedMessage,
        result.encryptedKeys.recipient,
        testPublicKey,
        recipientPrivateKey
      );

      expect(decryptedMessage).toBe(message);
    });

    it('should generate different ciphertexts for the same message', async () => {
      const message = 'Test message for encryption';
      
      // Mock the getAuditorPublicKey method
      jest.spyOn(encryptionService as any, 'getAuditorPublicKey').mockResolvedValue(auditorPublicKey);
      
      const result1 = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        testPrivateKey
      );
      
      const result2 = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        testPrivateKey
      );

      // Verify that the same message produces different ciphertexts (due to random nonce)
      expect(result1.encryptedMessage.ciphertext).not.toBe(result2.encryptedMessage.ciphertext);
      expect(result1.encryptedMessage.nonce).not.toBe(result2.encryptedMessage.nonce);
    });

    it('should fail to decrypt with incorrect keys', async () => {
      const message = 'Test message for decryption';
      
      // Mock the getAuditorPublicKey method
      jest.spyOn(encryptionService as any, 'getAuditorPublicKey').mockResolvedValue(auditorPublicKey);
      
      // Encrypt the message
      const encrypted = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        testPrivateKey
      );

      // Try to decrypt with wrong private key
      const wrongPrivateKey = randomBytes(32);
      
      await expect(
        encryptionService.decryptMessage(
          encrypted.encryptedMessage,
          encrypted.encryptedKeys.recipient,
          testPublicKey,
          wrongPrivateKey
        )
      ).rejects.toThrow();
    });

    it('should allow both recipient and auditor to decrypt the message', async () => {
      const message = 'Test message for multiple recipients';
      
      // Mock the getAuditorPublicKey method
      jest.spyOn(encryptionService as any, 'getAuditorPublicKey').mockResolvedValue(auditorPublicKey);
      
      // Encrypt the message
      const encrypted = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        testPrivateKey
      );

      // Decrypt as recipient
      const recipientDecrypted = await encryptionService.decryptMessage(
        encrypted.encryptedMessage,
        encrypted.encryptedKeys.recipient,
        testPublicKey,
        recipientPrivateKey
      );

      // Decrypt as auditor
      const auditorDecrypted = await encryptionService.decryptMessage(
        encrypted.encryptedMessage,
        encrypted.encryptedKeys.auditor,
        testPublicKey,
        auditorPrivateKey
      );

      expect(recipientDecrypted).toBe(message);
      expect(auditorDecrypted).toBe(message);
    });
  });

  describe('Error handling', () => {
    it('should throw error when agent keys are not found', () => {
      // Mock KeyManager to return false for hasAgentKeys
      jest.spyOn(KeyManager, 'hasAgentKeys').mockReturnValue(false);
      
      expect(() => {
        new EncryptionService('non-existent-agent');
      }).toThrow('Agent keys not found');
    });

    it('should throw error when auditor public key is not found', async () => {
      // Mock the getAuditorPublicKey method to throw an error
      jest.spyOn(encryptionService as any, 'getAuditorPublicKey').mockRejectedValue(
        new Error('Auditor public key not found in database')
      );
      
      await expect(
        encryptionService.encryptMessageForRecipients(
          'test message',
          recipientPublicKey,
          testPrivateKey
        )
      ).rejects.toThrow('Auditor public key not found in database');
    });
  });
}); 