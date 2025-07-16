import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { KeyManager } from '../../src/utils/key-manager.js';

describe('KeyManager Integration Tests', () => {
  const testStoragePath = path.join(process.cwd(), '.test-storage');
  const agentId = 'test-agent-123';
  const publicKey = 'public-key-content';
  const privateKey = 'private-key-content';

  beforeEach(() => {
    // Clean up test storage directory
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true, force: true });
    }
    
    // Reset KeyManager static state
    (KeyManager as any).fileManager = undefined;
  });

  afterEach(() => {
    // Clean up test storage directory
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true, force: true });
    }
    
    // Reset KeyManager static state
    (KeyManager as any).fileManager = undefined;
  });

  describe('initialize', () => {
    it('should create storage directory with correct permissions', async () => {
      KeyManager.initialize(testStoragePath);
      
      // Directory is created when first file operation occurs
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      expect(fs.existsSync(testStoragePath)).toBe(true);
      
      // Check directory permissions (0o700 = 448 in decimal)
      const stats = fs.statSync(testStoragePath);
      expect(stats.mode & 0o777).toBe(0o700);
    });

    it('should use default storage path when not specified', async () => {
      KeyManager.initialize();
      
      // Directory is created when first file operation occurs
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      const defaultPath = path.join(process.cwd(), '.storage');
      expect(fs.existsSync(defaultPath)).toBe(true);
      
      // Clean up default path
      if (fs.existsSync(defaultPath)) {
        fs.rmSync(defaultPath, { recursive: true, force: true });
      }
    });
  });

  describe('initializeAgentKeys', () => {
    it('should create agent key files', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      const encryptionDir = path.join(testStoragePath, 'encryption', agentId);
      const publicKeyPath = path.join(encryptionDir, 'public.key');
      const privateKeyPath = path.join(encryptionDir, 'private.key');
      
      expect(fs.existsSync(encryptionDir)).toBe(true);
      expect(fs.existsSync(publicKeyPath)).toBe(true);
      expect(fs.existsSync(privateKeyPath)).toBe(true);
      
      // Check file contents
      expect(fs.readFileSync(publicKeyPath, 'utf-8')).toBe(publicKey);
      expect(fs.readFileSync(privateKeyPath, 'utf-8')).toBe(privateKey);
      
      // Check file permissions (0o600 = 384 in decimal)
      const publicStats = fs.statSync(publicKeyPath);
      const privateStats = fs.statSync(privateKeyPath);
      expect(publicStats.mode & 0o777).toBe(0o600);
      expect(privateStats.mode & 0o777).toBe(0o600);
    });

    it('should handle multiple agents', async () => {
      KeyManager.initialize(testStoragePath);
      
      const agent1 = 'agent-1';
      const agent2 = 'agent-2';
      const key1 = 'key-1';
      const key2 = 'key-2';
      
      await KeyManager.initializeAgentKeys(agent1, key1, key1);
      await KeyManager.initializeAgentKeys(agent2, key2, key2);
      
      const agent1Dir = path.join(testStoragePath, 'encryption', agent1);
      const agent2Dir = path.join(testStoragePath, 'encryption', agent2);
      
      expect(fs.existsSync(agent1Dir)).toBe(true);
      expect(fs.existsSync(agent2Dir)).toBe(true);
      
      expect(fs.readFileSync(path.join(agent1Dir, 'public.key'), 'utf-8')).toBe(key1);
      expect(fs.readFileSync(path.join(agent2Dir, 'public.key'), 'utf-8')).toBe(key2);
    });
  });

  describe('getAgentPublicKey', () => {
    it('should return public key when it exists', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      const result = KeyManager.getAgentPublicKey(agentId);
      expect(result).toBe(publicKey);
    });

    it('should throw error when public key does not exist', () => {
      KeyManager.initialize(testStoragePath);
      
      expect(() => {
        KeyManager.getAgentPublicKey(agentId);
      }).toThrow(`No public key found for agent ${agentId}`);
    });
  });

  describe('getAgentPrivateKey', () => {
    it('should return private key when it exists', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      const result = KeyManager.getAgentPrivateKey(agentId);
      expect(result).toBe(privateKey);
    });

    it('should throw error when private key does not exist', () => {
      KeyManager.initialize(testStoragePath);
      
      expect(() => {
        KeyManager.getAgentPrivateKey(agentId);
      }).toThrow(`No private key found for agent ${agentId}`);
    });
  });

  describe('hasAgentKeys', () => {
    it('should return true when both keys exist', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      const result = KeyManager.hasAgentKeys(agentId);
      expect(result).toBe(true);
    });

    it('should return false when public key is missing', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      // Delete public key
      const publicKeyPath = path.join(testStoragePath, 'encryption', agentId, 'public.key');
      fs.unlinkSync(publicKeyPath);
      
      const result = KeyManager.hasAgentKeys(agentId);
      expect(result).toBe(false);
    });

    it('should return false when private key is missing', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      // Delete private key
      const privateKeyPath = path.join(testStoragePath, 'encryption', agentId, 'private.key');
      fs.unlinkSync(privateKeyPath);
      
      const result = KeyManager.hasAgentKeys(agentId);
      expect(result).toBe(false);
    });

    it('should return false when neither key exists', () => {
      KeyManager.initialize(testStoragePath);
      
      const result = KeyManager.hasAgentKeys(agentId);
      expect(result).toBe(false);
    });
  });

  describe('removeAgentKeys', () => {
    it('should delete both keys when they exist', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      const publicKeyPath = path.join(testStoragePath, 'encryption', agentId, 'public.key');
      const privateKeyPath = path.join(testStoragePath, 'encryption', agentId, 'private.key');
      
      expect(fs.existsSync(publicKeyPath)).toBe(true);
      expect(fs.existsSync(privateKeyPath)).toBe(true);
      
      KeyManager.removeAgentKeys(agentId);
      
      expect(fs.existsSync(publicKeyPath)).toBe(false);
      expect(fs.existsSync(privateKeyPath)).toBe(false);
    });

    it('should handle missing keys gracefully', async () => {
      KeyManager.initialize(testStoragePath);
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      
      // Delete one key manually
      const publicKeyPath = path.join(testStoragePath, 'encryption', agentId, 'public.key');
      fs.unlinkSync(publicKeyPath);
      
      // Should not throw when removing keys
      expect(() => {
        KeyManager.removeAgentKeys(agentId);
      }).not.toThrow();
      
      // Private key should still be deleted
      const privateKeyPath = path.join(testStoragePath, 'encryption', agentId, 'private.key');
      expect(fs.existsSync(privateKeyPath)).toBe(false);
    });
  });

  describe('complete lifecycle', () => {
    it('should handle full key lifecycle', async () => {
      KeyManager.initialize(testStoragePath);
      
      // Initialize keys
      await KeyManager.initializeAgentKeys(agentId, publicKey, privateKey);
      expect(KeyManager.hasAgentKeys(agentId)).toBe(true);
      
      // Get keys
      expect(KeyManager.getAgentPublicKey(agentId)).toBe(publicKey);
      expect(KeyManager.getAgentPrivateKey(agentId)).toBe(privateKey);
      
      // Remove keys
      KeyManager.removeAgentKeys(agentId);
      expect(KeyManager.hasAgentKeys(agentId)).toBe(false);
      
      // Should throw when trying to get removed keys
      expect(() => KeyManager.getAgentPublicKey(agentId)).toThrow();
      expect(() => KeyManager.getAgentPrivateKey(agentId)).toThrow();
    });
  });
}); 