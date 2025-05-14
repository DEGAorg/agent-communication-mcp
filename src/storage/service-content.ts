import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger.js';

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
  private readonly storageDir: string;

  private constructor() {
    // Set up storage directory in project root
    const projectRoot = process.cwd();
    this.storageDir = path.join(projectRoot, 'storage', 'service-contents');
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 }); // Secure directory permissions
    }
  }

  static getInstance(): ServiceContentStorage {
    if (!ServiceContentStorage.instance) {
      ServiceContentStorage.instance = new ServiceContentStorage();
    }
    return ServiceContentStorage.instance;
  }

  private getServiceDir(serviceId: string): string {
    const serviceDir = path.join(this.storageDir, serviceId);
    if (!fs.existsSync(serviceDir)) {
      fs.mkdirSync(serviceDir, { recursive: true, mode: 0o700 });
    }
    return serviceDir;
  }

  private getContentPath(serviceId: string, version: string): string {
    return path.join(this.getServiceDir(serviceId), `${version}.json`);
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
      await fs.promises.writeFile(
        contentPath,
        JSON.stringify(serviceContent, null, 2),
        { mode: 0o600 } // Secure file permissions
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
      const serviceDir = this.getServiceDir(serviceId);
      const files = await fs.promises.readdir(serviceDir);

      if (files.length === 0) {
        return null;
      }

      if (version) {
        const contentPath = this.getContentPath(serviceId, version);
        if (!fs.existsSync(contentPath)) {
          return null;
        }
        const content = await fs.promises.readFile(contentPath, 'utf-8');
        return JSON.parse(content);
      } else {
        // Get the latest version
        const versions = files
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''))
          .sort()
          .reverse();

        if (versions.length === 0) {
          return null;
        }

        const contentPath = this.getContentPath(serviceId, versions[0]);
        const content = await fs.promises.readFile(contentPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      logger.error('Error getting service content:', error);
      throw error;
    }
  }

  async listVersions(serviceId: string): Promise<string[]> {
    try {
      const serviceDir = this.getServiceDir(serviceId);
      const files = await fs.promises.readdir(serviceDir);
      
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
      if (fs.existsSync(contentPath)) {
        await fs.promises.unlink(contentPath);
        logger.info(`Service content deleted for service ${serviceId}, version ${version}`);
      }
    } catch (error) {
      logger.error('Error deleting service content:', error);
      throw error;
    }
  }
} 