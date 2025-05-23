import { logger } from '../logger.js';
import { FileManager, FileType } from '../utils/file-manager.js';

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
  private readonly fileManager: FileManager;

  private constructor() {
    this.fileManager = FileManager.getInstance();
  }

  static getInstance(): ReceivedContentStorage {
    if (!ReceivedContentStorage.instance) {
      ReceivedContentStorage.instance = new ReceivedContentStorage();
    }
    return ReceivedContentStorage.instance;
  }

  private getContentPath(serviceId: string, paymentMessageId: string): string {
    return `${paymentMessageId}.json`;
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
      this.fileManager.writeFile(
        FileType.RECEIVED_CONTENT,
        content.service_id,
        JSON.stringify(receivedContent, null, 2),
        contentPath
      );

      logger.info(`Received content stored for payment message ${content.payment_message_id}`);
      return receivedContent;
    } catch (error) {
      logger.error('Error storing received content:', error);
      throw error;
    }
  }

  async getContent(serviceId: string, paymentMessageId: string): Promise<ReceivedContent | null> {
    try {
      const contentPath = this.getContentPath(serviceId, paymentMessageId);
      if (!this.fileManager.fileExists(FileType.RECEIVED_CONTENT, serviceId, contentPath)) {
        return null;
      }

      const content = this.fileManager.readFile(FileType.RECEIVED_CONTENT, serviceId, contentPath);
      return JSON.parse(content);
    } catch (error) {
      logger.error('Error getting received content:', error);
      throw error;
    }
  }

  async deleteContent(serviceId: string, paymentMessageId: string): Promise<void> {
    try {
      const contentPath = this.getContentPath(serviceId, paymentMessageId);
      if (this.fileManager.fileExists(FileType.RECEIVED_CONTENT, serviceId, contentPath)) {
        this.fileManager.deleteFile(FileType.RECEIVED_CONTENT, serviceId, contentPath);
        logger.info(`Received content deleted for payment message ${paymentMessageId}`);
      }
    } catch (error) {
      logger.error('Error deleting received content:', error);
      throw error;
    }
  }
} 