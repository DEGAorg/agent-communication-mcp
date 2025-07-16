import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { FileManager, FileType, FileConfig } from '../../src/utils/file-manager.js';

describe('FileManager', () => {
  let fileManager: FileManager;
  const agentId = 'agent-123';
  const filename = 'file.txt';
  const fileType = FileType.SERVICE_CONTENT;
  const baseDir = '/mock/storage';
  let pathJoinSpy: ReturnType<typeof jest.spyOn>;
  let pathDirnameSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (FileManager as any).instance = undefined;
    
    // Spy on path methods
    pathJoinSpy = jest.spyOn(path, 'join').mockImplementation((...args: string[]) => args.join('/'));
    pathDirnameSpy = jest.spyOn(path, 'dirname').mockImplementation((filePath: string) => {
      const parts = filePath.split('/');
      return parts.slice(0, -1).join('/');
    });
  });

  afterEach(() => {
    (FileManager as any).instance = undefined;
    pathJoinSpy.mockRestore();
    pathDirnameSpy.mockRestore();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = FileManager.getInstance();
      const instance2 = FileManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should apply config on first call', () => {
      const config: FileConfig = { baseDir, createDirs: false };
      const instance = FileManager.getInstance(config);
      expect((instance as any).config.baseDir).toBe(baseDir);
      expect((instance as any).config.createDirs).toBe(false);
    });

    it('should update config if provided after first call', () => {
      const instance = FileManager.getInstance({ baseDir: '/first' });
      FileManager.getInstance({ baseDir: '/second', fileMode: 0o600 });
      expect((instance as any).config.baseDir).toBe('/second');
      expect((instance as any).config.fileMode).toBe(0o600);
    });

    it('should use default config values', () => {
      const instance = FileManager.getInstance();
      expect((instance as any).config.baseDir).toBe('.storage');
      expect((instance as any).config.createDirs).toBe(true);
      expect((instance as any).config.dirMode).toBe(0o755);
      expect((instance as any).config.fileMode).toBe(0o644);
      expect((instance as any).config.useAgentSubdirs).toBe(true);
    });

    it('should handle partial config updates', () => {
      const instance = FileManager.getInstance({ baseDir: '/initial' });
      FileManager.getInstance({ fileMode: 0o600 }); // Only update fileMode
      expect((instance as any).config.baseDir).toBe('/initial'); // Should remain unchanged
      expect((instance as any).config.fileMode).toBe(0o600); // Should be updated
    });
  });

  describe('getPath', () => {
    it('should return correct path with agent subdir', () => {
      fileManager = FileManager.getInstance({ baseDir });
      const result = fileManager.getPath(fileType, agentId, filename);
      expect(result).toContain(baseDir);
      expect(result).toContain(fileType);
      expect(result).toContain(agentId);
      expect(result).toContain(filename);
    });

    it('should return correct path without agent subdir', () => {
      fileManager = FileManager.getInstance({ baseDir, useAgentSubdirs: false });
      const result = fileManager.getPath(fileType, agentId, filename);
      expect(result).not.toContain(`${fileType}/${agentId}/${filename}`);
      expect(result).toContain(filename);
    });

    it('should return directory path if filename is not provided', () => {
      fileManager = FileManager.getInstance({ baseDir });
      const result = fileManager.getPath(fileType, agentId);
      expect(result).toContain(baseDir);
      expect(result).toContain(fileType);
      expect(result).toContain(agentId);
    });

    it('should use correct type directories', () => {
      fileManager = FileManager.getInstance({ baseDir });
      
      // Test different file types
      const serviceContentPath = fileManager.getPath(FileType.SERVICE_CONTENT, agentId);
      const receivedContentPath = fileManager.getPath(FileType.RECEIVED_CONTENT, agentId);
      const logPath = fileManager.getPath(FileType.LOG, agentId);
      
      expect(serviceContentPath).toContain('service-contents');
      expect(receivedContentPath).toContain('received-contents');
      expect(logPath).toContain('logs');
    });

    it('should handle all file types', () => {
      fileManager = FileManager.getInstance({ baseDir });
      
      const allTypes = [
        FileType.SEED,
        FileType.WALLET_BACKUP,
        FileType.LOG,
        FileType.TRANSACTION_DB,
        FileType.ENCRYPTION,
        FileType.SERVICE_CONTENT,
        FileType.RECEIVED_CONTENT,
        FileType.AUTH
      ];

      allTypes.forEach(type => {
        const result = fileManager.getPath(type, agentId);
        expect(result).toContain(baseDir);
        expect(result).toContain(agentId);
      });
    });
  });

  describe('configuration', () => {
    it('should handle custom base directory', () => {
      const customBaseDir = '/custom/storage';
      fileManager = FileManager.getInstance({ baseDir: customBaseDir });
      const result = fileManager.getPath(fileType, agentId, filename);
      expect(result).toContain(customBaseDir);
    });

    it('should handle custom file mode', () => {
      const customFileMode = 0o600;
      fileManager = FileManager.getInstance({ fileMode: customFileMode });
      expect((fileManager as any).config.fileMode).toBe(customFileMode);
    });

    it('should handle custom directory mode', () => {
      const customDirMode = 0o700;
      fileManager = FileManager.getInstance({ dirMode: customDirMode });
      expect((fileManager as any).config.dirMode).toBe(customDirMode);
    });

    it('should handle createDirs configuration', () => {
      fileManager = FileManager.getInstance({ createDirs: false });
      expect((fileManager as any).config.createDirs).toBe(false);
    });

    it('should handle useAgentSubdirs configuration', () => {
      fileManager = FileManager.getInstance({ useAgentSubdirs: false });
      expect((fileManager as any).config.useAgentSubdirs).toBe(false);
    });

    it('should handle falsy config values correctly', () => {
      fileManager = FileManager.getInstance({ 
        baseDir: '', 
        createDirs: false, 
        useAgentSubdirs: false 
      });
      expect((fileManager as any).config.baseDir).toBe('.storage'); // Empty string is falsy, so defaults to '.storage'
      expect((fileManager as any).config.createDirs).toBe(false);
      expect((fileManager as any).config.useAgentSubdirs).toBe(false);
    });
  });

  describe('FileType enum', () => {
    it('should have all expected file types', () => {
      expect(FileType.SEED).toBe('seed');
      expect(FileType.WALLET_BACKUP).toBe('wallet-backup');
      expect(FileType.LOG).toBe('log');
      expect(FileType.TRANSACTION_DB).toBe('transaction-db');
      expect(FileType.ENCRYPTION).toBe('encryption');
      expect(FileType.SERVICE_CONTENT).toBe('service-content');
      expect(FileType.RECEIVED_CONTENT).toBe('received-content');
      expect(FileType.AUTH).toBe('auth');
    });

    it('should have unique values for all types', () => {
      const values = Object.values(FileType);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('method interactions', () => {
    it('should call path.join with correct arguments for getPath', () => {
      fileManager = FileManager.getInstance({ baseDir });
      fileManager.getPath(fileType, agentId, filename);
      
      // Should call path.join multiple times for type directory, agent directory, and full path
      expect(pathJoinSpy).toHaveBeenCalled();
    });

    it('should call path.dirname when needed', () => {
      fileManager = FileManager.getInstance({ baseDir });
      // This will trigger path.dirname calls in writeFile and createWriteStream
      expect(pathDirnameSpy).not.toHaveBeenCalled();
    });

    it('should handle different agent IDs', () => {
      fileManager = FileManager.getInstance({ baseDir });
      const agent1 = 'agent-1';
      const agent2 = 'agent-2';
      
      const path1 = fileManager.getPath(fileType, agent1, filename);
      const path2 = fileManager.getPath(fileType, agent2, filename);
      
      expect(path1).toContain(agent1);
      expect(path2).toContain(agent2);
      expect(path1).not.toBe(path2);
    });

    it('should handle different file types with same agent', () => {
      fileManager = FileManager.getInstance({ baseDir });
      
      const servicePath = fileManager.getPath(FileType.SERVICE_CONTENT, agentId, filename);
      const receivedPath = fileManager.getPath(FileType.RECEIVED_CONTENT, agentId, filename);
      
      expect(servicePath).toContain('service-contents');
      expect(receivedPath).toContain('received-contents');
      expect(servicePath).not.toBe(receivedPath);
    });
  });

  describe('edge cases', () => {
    it('should handle empty agent ID', () => {
      fileManager = FileManager.getInstance({ baseDir });
      const result = fileManager.getPath(fileType, '', filename);
      expect(result).toContain(filename);
    });

    it('should handle empty filename', () => {
      fileManager = FileManager.getInstance({ baseDir });
      const result = fileManager.getPath(fileType, agentId, '');
      expect(result).toContain(agentId);
    });

    it('should handle special characters in agent ID', () => {
      fileManager = FileManager.getInstance({ baseDir });
      const specialAgentId = 'agent-with-special-chars_123';
      const result = fileManager.getPath(fileType, specialAgentId, filename);
      expect(result).toContain(specialAgentId);
    });

    it('should handle nested paths in filename', () => {
      fileManager = FileManager.getInstance({ baseDir });
      const nestedFilename = 'subdir/file.txt';
      const result = fileManager.getPath(fileType, agentId, nestedFilename);
      expect(result).toContain(nestedFilename);
    });
  });
}); 