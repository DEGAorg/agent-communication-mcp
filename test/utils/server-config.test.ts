import { describe, it, expect } from '@jest/globals';
import { getDefaultServerConfig, validateServerConfig, ServerConfig } from '../../src/utils/server-config.js';

describe('server-config', () => {
  describe('getDefaultServerConfig', () => {
    it('should return the correct default configuration', () => {
      const config = getDefaultServerConfig();
      
      expect(config.name).toBe('agent-communication-mcp-server');
      expect(config.version).toBe('1.0.0');
      expect(config.capabilities).toEqual({
        resources: {},
        tools: {},
        prompts: {},
      });
    });

    it('should return a new object each time', () => {
      const config1 = getDefaultServerConfig();
      const config2 = getDefaultServerConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different object references
    });

    it('should have the correct structure', () => {
      const config = getDefaultServerConfig();
      
      expect(typeof config.name).toBe('string');
      expect(typeof config.version).toBe('string');
      expect(typeof config.capabilities).toBe('object');
      expect(config.capabilities).not.toBeNull();
      expect(typeof config.capabilities.resources).toBe('object');
      expect(typeof config.capabilities.tools).toBe('object');
      expect(typeof config.capabilities.prompts).toBe('object');
    });
  });

  describe('validateServerConfig', () => {
    it('should validate a correct configuration', () => {
      const validConfig: ServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      };
      
      expect(validateServerConfig(validConfig)).toBe(true);
    });

    it('should validate the default configuration', () => {
      const defaultConfig = getDefaultServerConfig();
      expect(validateServerConfig(defaultConfig)).toBe(true);
    });

    it('should reject configuration with missing name', () => {
      const invalidConfig = {
        version: '1.0.0',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      } as ServerConfig;
      
      expect(validateServerConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with missing version', () => {
      const invalidConfig = {
        name: 'test-server',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      } as ServerConfig;
      
      expect(validateServerConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with missing capabilities', () => {
      const invalidConfig = {
        name: 'test-server',
        version: '1.0.0',
      } as ServerConfig;
      
      expect(validateServerConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with null capabilities', () => {
      const invalidConfig: ServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        capabilities: null as any,
      };
      
      expect(validateServerConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with missing capability properties', () => {
      const invalidConfig = {
        name: 'test-server',
        version: '1.0.0',
        capabilities: {
          resources: {},
          tools: {},
          // missing prompts
        },
      } as ServerConfig;
      
      expect(validateServerConfig(invalidConfig)).toBe(false);
    });

    it('should reject configuration with wrong types', () => {
      const invalidConfig = {
        name: 123, // should be string
        version: '1.0.0',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      } as unknown as ServerConfig;
      
      expect(validateServerConfig(invalidConfig)).toBe(false);
    });

    it('should handle empty strings', () => {
      const configWithEmptyName: ServerConfig = {
        name: '',
        version: '1.0.0',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      };
      
      expect(validateServerConfig(configWithEmptyName)).toBe(true);
    });

    it('should handle capabilities with additional properties', () => {
      const configWithExtraProps = {
        name: 'test-server',
        version: '1.0.0',
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
          extra: {},
        },
      } as unknown as ServerConfig;
      
      expect(validateServerConfig(configWithExtraProps)).toBe(true);
    });
  });

  describe('integration', () => {
    it('should work together correctly', () => {
      const defaultConfig = getDefaultServerConfig();
      const isValid = validateServerConfig(defaultConfig);
      
      expect(isValid).toBe(true);
    });

    it('should maintain consistency between functions', () => {
      const config1 = getDefaultServerConfig();
      const config2 = getDefaultServerConfig();
      
      expect(validateServerConfig(config1)).toBe(true);
      expect(validateServerConfig(config2)).toBe(true);
      expect(config1).toEqual(config2);
    });
  });
}); 