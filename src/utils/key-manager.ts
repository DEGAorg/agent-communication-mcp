import { FileManager, FileType } from './file-manager.js';

export class KeyManager {
  private static fileManager: FileManager;

  /**
   * Initialize the KeyManager with a custom storage path
   */
  static initialize(storagePath: string = './storage'): void {
    this.fileManager = FileManager.getInstance({
      baseDir: storagePath,
      dirMode: 0o700,  // More restrictive for key directories
      fileMode: 0o600  // More restrictive for key files
    });
  }

  /**
   * Initialize the key storage for an agent
   */
  static async initializeAgentKeys(agentId: string, publicKey: string, privateKey: string): Promise<void> {
    if (!this.fileManager) {
      this.initialize();
    }
    this.fileManager.writeFile(FileType.ENCRYPTION, agentId, publicKey, 'public');
    this.fileManager.writeFile(FileType.ENCRYPTION, agentId, privateKey, 'private');
  }

  /**
   * Get the public key for an agent
   */
  static getAgentPublicKey(agentId: string): string {
    if (!this.fileManager) {
      this.initialize();
    }
    if (!this.fileManager.fileExists(FileType.ENCRYPTION, agentId, 'public')) {
      throw new Error(`No public key found for agent ${agentId}`);
    }
    return this.fileManager.readFile(FileType.ENCRYPTION, agentId, 'public');
  }

  /**
   * Get the private key for an agent
   */
  static getAgentPrivateKey(agentId: string): string {
    if (!this.fileManager) {
      this.initialize();
    }
    if (!this.fileManager.fileExists(FileType.ENCRYPTION, agentId, 'private')) {
      throw new Error(`No private key found for agent ${agentId}`);
    }
    return this.fileManager.readFile(FileType.ENCRYPTION, agentId, 'private');
  }

  /**
   * Verify if an agent has keys
   */
  static hasAgentKeys(agentId: string): boolean {
    if (!this.fileManager) {
      this.initialize();
    }
    return this.fileManager.fileExists(FileType.ENCRYPTION, agentId, 'public') &&
           this.fileManager.fileExists(FileType.ENCRYPTION, agentId, 'private');
  }

  /**
   * Remove an agent's keys
   */
  static removeAgentKeys(agentId: string): void {
    if (!this.fileManager) {
      this.initialize();
    }
    if (this.fileManager.fileExists(FileType.ENCRYPTION, agentId, 'public')) {
      this.fileManager.deleteFile(FileType.ENCRYPTION, agentId, 'public');
    }
    if (this.fileManager.fileExists(FileType.ENCRYPTION, agentId, 'private')) {
      this.fileManager.deleteFile(FileType.ENCRYPTION, agentId, 'private');
    }
  }
} 