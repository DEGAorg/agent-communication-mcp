import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ReceivedContentStorage, ReceivedContent } from '../../src/storage/received-content.js';
import { FileManager, FileType } from '../../src/utils/file-manager.js';
import { logger } from '../../src/logger.js';

// Mock dependencies
jest.mock('../../src/utils/file-manager.js');
jest.mock('../../src/logger.js');

// Explicitly mock the static getInstance method
(FileManager.getInstance as unknown as jest.Mock) = jest.fn();

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('ReceivedContentStorage', () => {
  let storage: ReceivedContentStorage;
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
    storage = ReceivedContentStorage.getInstance();
  });

  afterEach(() => {
    // Reset the singleton instance for each test
    (ReceivedContentStorage as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ReceivedContentStorage.getInstance();
      const instance2 = ReceivedContentStorage.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('storeContent', () => {
    const mockContent: ReceivedContent = {
      payment_message_id: 'payment-123',
      service_id: 'service-456',
      agent_id: 'agent-789',
      content: { key: 'value' },
      version: '1.0.0'
    };

    it('should store content with timestamp', async () => {
      const result = await storage.storeContent(mockContent);

      expect(mockFileManagerInstance.writeFile).toHaveBeenCalledWith(
        FileType.RECEIVED_CONTENT,
        mockContent.agent_id,
        expect.stringContaining('"created_at"'),
        'payment-123.json'
      );

      expect(result).toEqual({
        ...mockContent,
        created_at: expect.any(String)
      });

      // Verify the stored JSON contains the expected data
      const writeCall = mockFileManagerInstance.writeFile.mock.calls[0];
      const storedData = JSON.parse(writeCall[2] as string);
      
      expect(storedData).toEqual({
        ...mockContent,
        created_at: expect.any(String)
      });
    });

    it('should use payment_message_id as filename', async () => {
      await storage.storeContent(mockContent);

      expect(mockFileManagerInstance.writeFile).toHaveBeenCalledWith(
        FileType.RECEIVED_CONTENT,
        mockContent.agent_id,
        expect.any(String),
        'payment-123.json'
      );
    });

    it('should always overwrite created_at with current timestamp', async () => {
      const contentWithTimestamp = {
        ...mockContent,
        created_at: '2023-01-01T00:00:00.000Z'
      };

      const result = await storage.storeContent(contentWithTimestamp);

      // Should overwrite the existing timestamp with current time
      expect(result.created_at).not.toBe('2023-01-01T00:00:00.000Z');
      expect(result.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('getContent', () => {
    const mockStoredContent = {
      payment_message_id: 'payment-123',
      service_id: 'service-456',
      agent_id: 'agent-789',
      content: { key: 'value' },
      version: '1.0.0',
      created_at: '2023-01-01T00:00:00.000Z'
    };

    it('should retrieve content successfully', async () => {
      mockFileManagerInstance.readFile.mockReturnValue(JSON.stringify(mockStoredContent));

      const result = await storage.getContent('agent-789', 'service-456', 'payment-123');

      expect(mockFileManagerInstance.readFile).toHaveBeenCalledWith(
        FileType.RECEIVED_CONTENT,
        'agent-789',
        'payment-123.json'
      );

      expect(result).toEqual(mockStoredContent);
    });

    it('should return null when file does not exist', async () => {
      mockFileManagerInstance.readFile.mockImplementation(() => {
        throw new Error('File does not exist');
      });

      const result = await storage.getContent('agent-789', 'service-456', 'payment-123');

      expect(result).toBeNull();
    });

    it('should return null when file contains invalid JSON', async () => {
      mockFileManagerInstance.readFile.mockReturnValue('invalid json');

      const result = await storage.getContent('agent-789', 'service-456', 'payment-123');

      expect(result).toBeNull();
    });

    it('should return null when readFile throws any error', async () => {
      mockFileManagerInstance.readFile.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await storage.getContent('agent-789', 'service-456', 'payment-123');

      expect(result).toBeNull();
    });
  });

  describe('listContent', () => {
    const mockFiles = ['payment-123.json', 'payment-456.json', 'payment-789.json'];
    const mockStoredContents = [
      {
        payment_message_id: 'payment-123',
        service_id: 'service-456',
        agent_id: 'agent-789',
        content: { key: 'value1' },
        version: '1.0.0',
        created_at: '2023-01-01T00:00:00.000Z'
      },
      {
        payment_message_id: 'payment-456',
        service_id: 'service-789',
        agent_id: 'agent-789',
        content: { key: 'value2' },
        version: '1.0.0',
        created_at: '2023-01-02T00:00:00.000Z'
      }
    ];

    it('should list all content for an agent', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue(mockFiles);
      mockFileManagerInstance.readFile
        .mockReturnValueOnce(JSON.stringify(mockStoredContents[0]))
        .mockReturnValueOnce(JSON.stringify(mockStoredContents[1]))
        .mockReturnValueOnce(JSON.stringify(mockStoredContents[0])); // For the third file

      const result = await storage.listContent('agent-789');

      expect(mockFileManagerInstance.listFiles).toHaveBeenCalledWith(
        FileType.RECEIVED_CONTENT,
        'agent-789'
      );

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        mockStoredContents[0],
        mockStoredContents[1],
        mockStoredContents[0]
      ]);
    });

    it('should skip files that cannot be read', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue(['valid.json', 'invalid.json']);
      mockFileManagerInstance.readFile
        .mockReturnValueOnce(JSON.stringify(mockStoredContents[0]))
        .mockImplementationOnce(() => {
          throw new Error('Cannot read file');
        });

      const result = await storage.listContent('agent-789');

      expect(result).toHaveLength(1);
      expect(result).toEqual([mockStoredContents[0]]);
    });

    it('should skip files with invalid JSON', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue(['valid.json', 'invalid.json']);
      mockFileManagerInstance.readFile
        .mockReturnValueOnce(JSON.stringify(mockStoredContents[0]))
        .mockReturnValueOnce('invalid json');

      const result = await storage.listContent('agent-789');

      expect(result).toHaveLength(1);
      expect(result).toEqual([mockStoredContents[0]]);
    });

    it('should return empty array when no files exist', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue([]);

      const result = await storage.listContent('agent-789');

      expect(result).toEqual([]);
    });

    it('should handle mixed valid and invalid files', async () => {
      mockFileManagerInstance.listFiles.mockReturnValue(['valid1.json', 'invalid.json', 'valid2.json']);
      mockFileManagerInstance.readFile
        .mockReturnValueOnce(JSON.stringify(mockStoredContents[0]))
        .mockImplementationOnce(() => {
          throw new Error('Cannot read file');
        })
        .mockReturnValueOnce(JSON.stringify(mockStoredContents[1]));

      const result = await storage.listContent('agent-789');

      expect(result).toHaveLength(2);
      expect(result).toEqual([mockStoredContents[0], mockStoredContents[1]]);
    });
  });

  describe('deleteContent', () => {
    it('should delete content file', async () => {
      await storage.deleteContent('agent-789', 'payment-123');

      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith(
        FileType.RECEIVED_CONTENT,
        'agent-789',
        'payment-123.json'
      );
    });

    it('should use correct filename format', async () => {
      await storage.deleteContent('agent-789', 'payment-456');

      expect(mockFileManagerInstance.deleteFile).toHaveBeenCalledWith(
        FileType.RECEIVED_CONTENT,
        'agent-789',
        'payment-456.json'
      );
    });
  });

  describe('error handling', () => {
    it('should handle FileManager errors gracefully in storeContent', async () => {
      mockFileManagerInstance.writeFile.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const mockContent: ReceivedContent = {
        payment_message_id: 'payment-123',
        service_id: 'service-456',
        agent_id: 'agent-789',
        content: { key: 'value' },
        version: '1.0.0'
      };

      await expect(storage.storeContent(mockContent)).rejects.toThrow('Disk full');
    });

    it('should handle FileManager errors gracefully in deleteContent', async () => {
      mockFileManagerInstance.deleteFile.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(storage.deleteContent('agent-789', 'payment-123')).rejects.toThrow('Permission denied');
    });
  });
}); 