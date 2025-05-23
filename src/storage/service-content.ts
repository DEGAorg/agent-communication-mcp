import { logger } from '../logger.js';
import { FileManager, FileType } from '../utils/file-manager.js';

export interface ServiceContent {
  service_id: string;
  agent_id: string;
  content: Record<string, any>;
  version: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export class ServiceContentStorage {
  private static instance: ServiceContentStorage;
  private readonly fileManager: FileManager;

  private constructor() {
    this.fileManager = FileManager.getInstance();
  }

  static getInstance(): ServiceContentStorage {
    if (!ServiceContentStorage.instance) {
      ServiceContentStorage.instance = new ServiceContentStorage();
    }
    return ServiceContentStorage.instance;
  }

  private getContentPath(serviceId: string, version: string): string {
    return `${version}.json`;
  }

  async storeContent(content: Omit<ServiceContent, 'created_at' | 'updated_at'>): Promise<ServiceContent> {
    try {
      const timestamp = new Date().toISOString();
      const serviceContent: ServiceContent = {
        ...content,
        created_at: timestamp,
        updated_at: timestamp
      };

      const contentPath = this.getContentPath(content.service_id, content.version);
      this.fileManager.writeFile(
        FileType.SERVICE_CONTENT,
        content.service_id,
        JSON.stringify(serviceContent, null, 2),
        contentPath
      );

      logger.info(`Service content stored for service ${content.service_id}, version ${content.version}`);
      return serviceContent;
    } catch (error) {
      logger.error('Error storing service content:', error);
      throw error;
    }
  }

  async getContent(serviceId: string, version?: string): Promise<ServiceContent | null> {
    try {
      if (version) {
        const contentPath = this.getContentPath(serviceId, version);
        if (!this.fileManager.fileExists(FileType.SERVICE_CONTENT, serviceId, contentPath)) {
          return null;
        }
        const content = this.fileManager.readFile(FileType.SERVICE_CONTENT, serviceId, contentPath);
        return JSON.parse(content);
      } else {
        // Get the latest version
        const files = this.fileManager.listFiles(FileType.SERVICE_CONTENT, serviceId);
        const versions = files
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''))
          .sort()
          .reverse();

        if (versions.length === 0) {
          return null;
        }

        const contentPath = this.getContentPath(serviceId, versions[0]);
        const content = this.fileManager.readFile(FileType.SERVICE_CONTENT, serviceId, contentPath);
        return JSON.parse(content);
      }
    } catch (error) {
      logger.error('Error getting service content:', error);
      throw error;
    }
  }

  async listVersions(serviceId: string): Promise<string[]> {
    try {
      const files = this.fileManager.listFiles(FileType.SERVICE_CONTENT, serviceId);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''))
        .sort()
        .reverse();
    } catch (error) {
      logger.error('Error listing service content versions:', error);
      throw error;
    }
  }

  async deleteContent(serviceId: string, version: string): Promise<void> {
    try {
      const contentPath = this.getContentPath(serviceId, version);
      if (this.fileManager.fileExists(FileType.SERVICE_CONTENT, serviceId, contentPath)) {
        this.fileManager.deleteFile(FileType.SERVICE_CONTENT, serviceId, contentPath);
        logger.info(`Service content deleted for service ${serviceId}, version ${version}`);
      }
    } catch (error) {
      logger.error('Error deleting service content:', error);
      throw error;
    }
  }
} 