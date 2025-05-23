import { logger } from '../logger.js';
import { FileManager, FileType } from '../utils/file-manager.js';

export interface ServiceContent {
  service_id: string;
  agent_id: string;
  content: Record<string, any>;
  version: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export class ServiceContentStorage {
  private static instance: ServiceContentStorage;
  private fileManager: FileManager;

  private constructor() {
    this.fileManager = FileManager.getInstance();
  }

  public static getInstance(): ServiceContentStorage {
    if (!ServiceContentStorage.instance) {
      ServiceContentStorage.instance = new ServiceContentStorage();
    }
    return ServiceContentStorage.instance;
  }

  /**
   * Store service content
   */
  public async storeContent(content: ServiceContent): Promise<ServiceContent> {
    const filename = `${content.service_id}_${content.version}.json`;
    const timestamp = new Date().toISOString();
    
    const contentToStore = {
      ...content,
      created_at: timestamp,
      updated_at: timestamp
    };

    this.fileManager.writeFile(
      FileType.SERVICE_CONTENT,
      content.agent_id,
      JSON.stringify(contentToStore, null, 2),
      filename
    );

    return contentToStore;
  }

  /**
   * Retrieve service content
   * If version is not provided, returns the latest version
   */
  public async getContent(agentId: string, serviceId: string, version?: string): Promise<ServiceContent | null> {
    if (version) {
      const filename = `${serviceId}_${version}.json`;
      try {
        const content = this.fileManager.readFile(
          FileType.SERVICE_CONTENT,
          agentId,
          filename
        );
        return JSON.parse(content);
      } catch (error) {
        return null;
      }
    } else {
      // Get the latest version
      const versions = await this.listContentVersions(agentId, serviceId);
      if (versions.length === 0) {
        return null;
      }
      // Sort versions in descending order and get the latest
      const latestVersion = versions.sort().reverse()[0];
      return this.getContent(agentId, serviceId, latestVersion);
    }
  }

  /**
   * List all content versions for a service
   */
  public async listContentVersions(agentId: string, serviceId: string): Promise<string[]> {
    const files = this.fileManager.listFiles(FileType.SERVICE_CONTENT, agentId);
    return files
      .filter(file => file.startsWith(`${serviceId}_`) && file.endsWith('.json'))
      .map(file => file.replace(`${serviceId}_`, '').replace('.json', ''));
  }

  /**
   * Delete service content
   */
  public async deleteContent(agentId: string, serviceId: string, version: string): Promise<void> {
    const filename = `${serviceId}_${version}.json`;
    this.fileManager.deleteFile(FileType.SERVICE_CONTENT, agentId, filename);
  }
} 