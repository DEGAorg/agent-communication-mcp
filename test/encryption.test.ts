import { EncryptionService } from '../src/encryption/service.js';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let testPublicKey: Uint8Array;
  let testPrivateKey: Uint8Array;
  let recipientPublicKey: Uint8Array;
  let recipientPrivateKey: Uint8Array;
  let auditorPublicKey: Uint8Array;
  let auditorPrivateKey: Uint8Array;

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

    encryptionService = new EncryptionService();
  });

  describe('getPublicKey', () => {
    it('should return the correct public key', () => {
      const publicKey = encryptionService.getPublicKey();
      expect(Buffer.from(publicKey).toString('base64')).toBe(
        Buffer.from(testPublicKey).toString('base64')
      );
    });
  });

  describe('encryptMessageForRecipients', () => {
    it('should encrypt a message for multiple recipients', async () => {
      const message = 'Test message for encryption';
      
      const result = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        auditorPublicKey,
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
    });

    it('should generate different ciphertexts for the same message', async () => {
      const message = 'Test message for encryption';
      
      const result1 = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        auditorPublicKey,
        testPrivateKey
      );
      
      const result2 = await encryptionService.encryptMessageForRecipients(
        message,
        recipientPublicKey,
        auditorPublicKey,
        testPrivateKey
      );

      // Verify that the same message produces different ciphertexts (due to random nonce)
      expect(result1.encryptedMessage.ciphertext).not.toBe(result2.encryptedMessage.ciphertext);
      expect(result1.encryptedMessage.nonce).not.toBe(result2.encryptedMessage.nonce);
    });
  });

  describe('decryptMessage', () => {
    it('should successfully decrypt an encrypted message', async () => {
      const originalMessage = 'Test message for decryption';
      
      // Encrypt the message
      const encrypted = await encryptionService.encryptMessageForRecipients(
        originalMessage,
        recipientPublicKey,
        auditorPublicKey,
        testPrivateKey
      );

      // Decrypt the message as the recipient
      const decryptedMessage = await encryptionService.decryptMessage(
        encrypted.encryptedMessage,
        encrypted.encryptedKeys.recipient,
        testPublicKey,
        recipientPrivateKey
      );

      expect(decryptedMessage).toBe(originalMessage);
    });

    it('should fail to decrypt with incorrect keys', async () => {
      const originalMessage = 'Test message for decryption';
      
      // Encrypt the message
      const encrypted = await encryptionService.encryptMessageForRecipients(
        originalMessage,
        recipientPublicKey,
        auditorPublicKey,
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
      const originalMessage = 'Test message for multiple recipients';
      
      // Encrypt the message
      const encrypted = await encryptionService.encryptMessageForRecipients(
        originalMessage,
        recipientPublicKey,
        auditorPublicKey,
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

      expect(recipientDecrypted).toBe(originalMessage);
      expect(auditorDecrypted).toBe(originalMessage);
    });
  });
}); 