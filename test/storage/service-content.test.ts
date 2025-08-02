import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ServiceContentStorage, ServiceContent } from '../../src/storage/service-content.js';
import { FileManager, FileType } from '../../src/utils/file-manager.js';
import { logger } from '../../src/logger.js';

// Mock dependencies
jest.mock('../../src/utils/file-manager.js');
jest.mock('../../src/logger.js');

// Explicitly mock the static getInstance method
(FileManager.getInstance as unknown as jest.Mock) = jest.fn();

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('ServiceContentStorage', () => {
  let storage: ServiceContentStorage;
  let mockFileManagerInstance: jest.Mocked<FileManager>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock FileManager instance
    mockFileManagerInstance = {
      writeFile: jest.fn(),
      readFile: jest.fn(),
      listFiles: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      getPath: jest.fn(),
      ensureDirectoryExists: jest.fn(),
      getFileStats: jest.fn(),
      createReadStream: jest.fn(),
      createWriteStream: jest.fn(),
    } as any;

    // Mock the static getInstance method
    (FileManager.getInstance as jest.Mock).mockReturnValue(mockFileManagerInstance);
    
    // Get the storage instance
    storage = ServiceContentStorage.getInstance();
  });

  afterEach(() => {
    // Reset the singleton instance for each test
    (ServiceContentStorage as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ServiceContentStorage.getInstance();
      const instance2 = ServiceContentStorage.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('storeContent', () => {
    const mockContent: ServiceContent = {
      service_id: 'service-123',
      agent_id: 'agent-456',
      content: { key: 'value' },
      version: '1.0.0',
      tags: ['tag1', 'tag2']
    };

    it('should store content with timestamps', async () => {
      const result = await storage.storeContent(mockContent);

      expect(mockFileManagerInstance.writeFile).toHaveBeenCalledWith(
        FileType.SERVICE_CONTENT,
        mockContent.agent_id,
        expect.stringContaining('"created_at"'),
        'service-123_1.0.0.json'
      );

      expect(result).toEqual({
        ...mockContent,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });

      // Verify the stored JSON contains the expected data
      const writeCall = mockFileManagerInstance.writeFile.mock.calls[0];
      const storedData = JSON.parse(writeCall[2] as string);
      
      expect(storedData).toEqual({
        ...mockContent,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('should use service_id and version as filename', async () => {
      await storage.storeContent(mockContent);

      expect(mockFileManagerInstance.writeFile).toHaveBeenCalledWith(
        FileType.SERVICE_CONTENT,
        mockContent.agent_id,
        expect.any(String),
        'service-123_1.0.0.json'
      );
    });

    it('should always overwrite timestamps with current time', async () => {
      const contentWithTimestamps = {
        ...mockContent,
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-02T00:00:00.000Z'
      };

      const result = await storage.storeContent(contentWithTimestamps);

      // Should overwrite the existing timestamps with current time
      expect(result.created_at).not.toBe('2023-01-01T00:00:00.000Z');
      expect(result.updated_at).not.toBe('2023-01-02T00:00:00.000Z');
      expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle content without tags', async () => {
      const contentWithoutTags = {
        service_id: 'service-123',
        agent_id: 'agent-456',
        content: { key: 'value' },
        version: '1.0.0'
      };

      const result = await storage.storeContent(contentWithoutTags);

      expect(result).toEqual({
        ...contentWithoutTags,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });
  });

  describe('getContent', () => {
    const mockStoredContent = {
      service_id: 'service-123',
      agent_id: 'agent-456',
      content: { key: 'value' },
      version: '1.0.0',
      tags: ['tag1', 'tag2'],
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z'
    };

    describe('with specific version', () => {
      it('should retrieve content successfully', async () => {
        mockFileManagerInstance.readFile.mockReturnValue(JSON.stringify(mockStoredContent));

        const result = await storage.getContent('agent-456', 'service-123', '1.0.0');

        expect(mockFileManagerInstance.readFile).toHaveBeenCalledWith(
          FileType.SERVICE_CONTENT,
          'agent-456',
          'service-123_1.0.0.json'
        );

        expect(result).toEqual(mockStoredContent);
      });

      it('should return null when file does not exist', async () => {
        mockFileManagerInstance.readFile.mockImplementation(() => {
          throw new Error('File does not exist');
        });

        const result = await storage.getContent('agent-456', 'service-123', '1.0.0');

        expect(result).toBeNull();
      });

      it('should return null when file contains invalid JSON', async () => {
        mockFileManagerInstance.readFile.mockReturnValue('invalid json');

        const result = await storage.getContent('agent-456', 'service-123', '1.0.0');

        expect(result).toBeNull();
      });

      it('should return null when readFile throws any error', async () => {
        mockFileManagerInstance.readFile.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        const result = await storage.getContent('agent-456', 'service-123', '1.0.0');

        expect(result).toBeNull();
      });
    });

    describe('without version (latest)', () => {
      it('should return latest version when multiple versions exist', async () => {
        mockFileManagerInstance.listFiles.mockReturnValue([
          'service-123_1.0.0.json',
          'service-123_2.0.0.json',
          'service-123_1.5.0.json'
        ]);
        mockFileManagerInstance.readFile.mockReturnValue(JSON.stringify(mockStoredContent));

        const result = await storage.getContent('agent-456', 'service-123');

        expect(mockFileManagerInstance.listFiles).toHaveBeenCalledWith(
          FileType.SERVICE_CONTENT,
          'agent-456'
        );
        expect(mockFileManagerInstance.readFile).toHaveBeenCalledWith(
          FileType.SERVICE_CONTENT,
          'agent-456',
          'service-123_2.0.0.json'
        );
        expect(result).toEqual(mockStoredContent);
      });

      it('should return null when no versions exist', async () => {
        mockFileManagerInstance.listFiles.mockReturnValue([]);

        const result = await storage.getContent('agent-456', 'service-123');

        expect(result).toBeNull();
      });

      it('should return null when no matching service files exist', async () => {
        mockFileManagerInstance.listFiles.mockReturnValue([
          'other-service_1.0.0.json',
          'another-service_2.0.0.json'
        ]);

        const result = await storage.getContent('agent-456', 'service-123');

        expect(result).toBeNull();
      });

      it('should handle version sorting correctly', async () => {
        mockFileManagerInstance.listFiles.mockReturnValue([
          'service-123_1.0.0.json',
          'service-123_10.0.0.json',
          'service-123_2.0.0.json'
        ]);
        mockFileManagerInstance.readFile.mockReturnValue(JSON.stringify(mockStoredContent));

        const result = await storage.getContent('agent-456', 'service-123');

        // Lexicographic sorting: 1.0.0, 10.0.0, 2.0.0 -> reverse -> 2.0.0, 10.0.0, 1.0.0
        // So 2.0.0 is the "latest" in lexicographic order
        expect(mockFileManagerInstance.readFile).toHaveBeenCalledWith(
          FileType.SERVICE_CONTENT,
          'agent-456',
          'service-123_2.0.0.json'
        );
      });
    });
  });

  describe('listContentVersions', () => {
    it('should list all versions for a service', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue([
        'service-123_1.0.0.json',
        'service-123_2.0.0.json',
        'service-123_1.5.0.json',
        'other-service_1.0.0.json'
      ]);

      const result = await storage.listContentVersions('agent-456', 'service-123');

      expect(mockFileManagerInstance.listFiles).toHaveBeenCalledWith(
        FileType.SERVICE_CONTENT,
        'agent-456'
      );
      expect(result).toEqual(['1.0.0', '2.0.0', '1.5.0']);
    });

    it('should return empty array when no versions exist', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue([]);

      const result = await storage.listContentVersions('agent-456', 'service-123');

      expect(result).toEqual([]);
    });

    it('should return empty array when no matching service files exist', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue([
        'other-service_1.0.0.json',
        'another-service_2.0.0.json'
      ]);

      const result = await storage.listContentVersions('agent-456', 'service-123');

      expect(result).toEqual([]);
    });

    it('should handle files with different extensions', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue([
        'service-123_1.0.0.json',
        'service-123_2.0.0.txt', // Should be ignored
        'service-123_1.5.0.json'
      ]);

      const result = await storage.listContentVersions('agent-456', 'service-123');

      expect(result).toEqual(['1.0.0', '1.5.0']);
    });

    it('should handle files with different service prefixes', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue([
        'service-123_1.0.0.json',
        'service-123-extra_2.0.0.json', // Should be ignored
        'service-123_1.5.0.json'
      ]);

      const result = await storage.listContentVersions('agent-456', 'service-123');

      expect(result).toEqual(['1.0.0', '1.5.0']);
    });
  });

  describe('deleteContent', () => {
    it('should delete content file', async () => {
      await storage.deleteContent('agent-456', 'service-123', '1.0.0');

      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith(
        FileType.SERVICE_CONTENT,
        'agent-456',
        'service-123_1.0.0.json'
      );
    });

    it('should use correct filename format', async () => {
      await storage.deleteContent('agent-456', 'service-789', '2.5.0');

      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith(
        FileType.SERVICE_CONTENT,
        'agent-456',
        'service-789_2.5.0.json'
      );
    });
  });

  describe('error handling', () => {
    it('should handle FileManager errors gracefully in storeContent', async () => {
      mockFileManagerInstance.writeFile.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const mockContent: ServiceContent = {
        service_id: 'service-123',
        agent_id: 'agent-456',
        content: { key: 'value' },
        version: '1.0.0'
      };

      await expect(storage.storeContent(mockContent)).rejects.toThrow('Disk full');
    });

    it('should handle FileManager errors gracefully in deleteContent', async () => {
      mockFileManagerInstance.deleteFile.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(storage.deleteContent('agent-456', 'service-123', '1.0.0')).rejects.toThrow('Permission denied');
    });

    it('should handle FileManager errors gracefully in listContentVersions', async () => {
      mockFileManagerInstance.listFiles.mockImplementation(() => {
        throw new Error('Directory not found');
      });

      await expect(storage.listContentVersions('agent-456', 'service-123')).rejects.toThrow('Directory not found');
    });
  });
}); 