import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger.js';

export interface ReceivedContent {
  payment_message_id: string;
  service_id: string;
  content: Record<string, any>;
  version: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export class ReceivedContentStorage {
  private static instance: ReceivedContentStorage;
  private readonly storageDir: string;

  private constructor() {
    // Set up storage directory in project root
    const projectRoot = process.cwd();
    this.storageDir = path.join(projectRoot, 'storage', 'received-contents');
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 }); // Secure directory permissions
    }
  }

  static getInstance(): ReceivedContentStorage {
    if (!ReceivedContentStorage.instance) {
      ReceivedContentStorage.instance = new ReceivedContentStorage();
    }
    return ReceivedContentStorage.instance;
  }

  private getAgentDir(agentId: string): string {
    const agentDir = path.join(this.storageDir, agentId);
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true, mode: 0o700 });
    }
    return agentDir;
  }

  private getContentPath(agentId: string, paymentMessageId: string): string {
    return path.join(this.getAgentDir(agentId), `${paymentMessageId}.json`);
  }

  async storeContent(content: Omit<ReceivedContent, 'created_at' | 'updated_at'>): Promise<ReceivedContent> {
    try {
      const timestamp = new Date().toISOString();
      const receivedContent: ReceivedContent = {
        ...content,
        created_at: timestamp,
        updated_at: timestamp
      };

      const contentPath = this.getContentPath(content.service_id, content.payment_message_id);
      await fs.promises.writeFile(
        contentPath,
        JSON.stringify(receivedContent, null, 2),
        { mode: 0o600 } // Secure file permissions
      );

      logger.info(`Received content stored for payment message ${content.payment_message_id}`);
      return receivedContent;
    } catch (error) {
      logger.error('Error storing received content:', error);
      throw error;
    }
  }

  async getContent(agentId: string, paymentMessageId: string): Promise<ReceivedContent | null> {
    try {
      const contentPath = this.getContentPath(agentId, paymentMessageId);
      if (!fs.existsSync(contentPath)) {
        return null;
      }

      const content = await fs.promises.readFile(contentPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Error getting received content:', error);
      throw error;
    }
  }

  async deleteContent(agentId: string, paymentMessageId: string): Promise<void> {
    try {
      const contentPath = this.getContentPath(agentId, paymentMessageId);
      if (fs.existsSync(contentPath)) {
        await fs.promises.unlink(contentPath);
        logger.info(`Received content deleted for payment message ${paymentMessageId}`);
      }
    } catch (error) {
      logger.error('Error deleting received content:', error);
      throw error;
    }
  }
} 