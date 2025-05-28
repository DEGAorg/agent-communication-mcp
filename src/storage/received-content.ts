import { logger } from '../logger.js';
import { FileManager, FileType } from '../utils/file-manager.js';

export interface ReceivedContent {
  payment_message_id: string;
  service_id: string;
  agent_id: string;
  content: Record<string, any>;
  version: string;
  created_at?: string;
}

export class ReceivedContentStorage {
  private static instance: ReceivedContentStorage;
  private fileManager: FileManager;

  private constructor() {
    this.fileManager = FileManager.getInstance();
  }

  public static getInstance(): ReceivedContentStorage {
    if (!ReceivedContentStorage.instance) {
      ReceivedContentStorage.instance = new ReceivedContentStorage();
    }
    return ReceivedContentStorage.instance;
  }

  /**
   * Store received content
   */
  public async storeContent(content: ReceivedContent): Promise<ReceivedContent> {
    const filename = `${content.payment_message_id}.json`;
    const timestamp = new Date().toISOString();
    
    const contentToStore = {
      ...content,
      created_at: timestamp
    };

    this.fileManager.writeFile(
      FileType.RECEIVED_CONTENT,
      content.agent_id,
      JSON.stringify(contentToStore, null, 2),
      filename
    );

    return contentToStore;
  }

  /**
   * Retrieve received content
   */
  public async getContent(agentId: string, serviceId: string, paymentMessageId: string): Promise<ReceivedContent | null> {
    const filename = `${paymentMessageId}.json`;
    
    try {
      const content = this.fileManager.readFile(
        FileType.RECEIVED_CONTENT,
        agentId,
        filename
      );
      
      const parsedContent = JSON.parse(content);

      return parsedContent;
    } catch (error) {
      return null;
    }
  }

  /**
   * List all received content for an agent
   */
  public async listContent(agentId: string): Promise<ReceivedContent[]> {
    const files = this.fileManager.listFiles(FileType.RECEIVED_CONTENT, agentId);
    const contents: ReceivedContent[] = [];

    for (const file of files) {
      try {
        const content = this.fileManager.readFile(
          FileType.RECEIVED_CONTENT,
          agentId,
          file
        );
        contents.push(JSON.parse(content));
      } catch (error) {
        // Skip files that can't be read or parsed
        continue;
      }
    }

    return contents;
  }

  /**
   * Delete received content
   */
  public async deleteContent(agentId: string, paymentMessageId: string): Promise<void> {
    const filename = `${paymentMessageId}.json`;
    this.fileManager.deleteFile(FileType.RECEIVED_CONTENT, agentId, filename);
  }
} 