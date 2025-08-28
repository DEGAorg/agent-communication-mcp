import { Resource } from "@modelcontextprotocol/sdk/types.js";
import { 
  DEFAULT_AGENT_RESOURCE,
  SERVICES_LIST_RESOURCE,
  SERVICE_REGISTRATION_RESOURCE,
  SERVICE_CONTENT_RESOURCE,
  SERVICE_PAYMENT_RESOURCE,
  SERVICE_DELIVERY_RESOURCE,
  DATA_REVELATION_RESOURCE,
  AVAILABLE_TOOLS_RESOURCE,
  RESOURCES,
  handleListResources,
  handleReadResource
} from '../src/resources.js';
import { AppError } from '../src/errors/AppError.js';

describe('resources.ts', () => {
  describe('Resource definitions', () => {
    it('should have correct DEFAULT_AGENT_RESOURCE structure', () => {
      expect(DEFAULT_AGENT_RESOURCE.uri).toBe('agent://info');
      expect(DEFAULT_AGENT_RESOURCE.name).toBe('Agent Communication Information');
      expect(DEFAULT_AGENT_RESOURCE.description).toContain('communication capabilities');
      expect(DEFAULT_AGENT_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(DEFAULT_AGENT_RESOURCE.content as string);
      expect(content).toHaveProperty('capabilities');
      expect(content).toHaveProperty('state');
      expect(content.capabilities).toEqual({
        marketplace: true,
        authentication: true,
        payment: true,
        content: true
      });
      expect(content.state).toEqual({
        requires_authentication: true,
        requires_midnight_wallet: true
      });
    });

    it('should have correct SERVICES_LIST_RESOURCE structure', () => {
      expect(SERVICES_LIST_RESOURCE.uri).toBe('agent://services');
      expect(SERVICES_LIST_RESOURCE.name).toBe('Service Marketplace');
      expect(SERVICES_LIST_RESOURCE.description).toContain('Browse and search');
      expect(SERVICES_LIST_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(SERVICES_LIST_RESOURCE.content as string);
      expect(content).toHaveProperty('filters');
      expect(content).toHaveProperty('service_types');
      expect(content.filters).toEqual(['topics', 'price_range', 'service_type', 'status']);
      expect(content.service_types).toEqual([
        'AI_ANALYSIS', 'DATA_PROCESSING', 'API_INTEGRATION', 
        'COMPUTATION', 'STORAGE', 'CUSTOM'
      ]);
    });

    it('should have correct SERVICE_REGISTRATION_RESOURCE structure', () => {
      expect(SERVICE_REGISTRATION_RESOURCE.uri).toBe('agent://service-registration');
      expect(SERVICE_REGISTRATION_RESOURCE.name).toBe('Service Provider Portal');
      expect(SERVICE_REGISTRATION_RESOURCE.description).toContain('Register and manage');
      expect(SERVICE_REGISTRATION_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(SERVICE_REGISTRATION_RESOURCE.content as string);
      expect(content).toHaveProperty('required_fields');
      expect(content.required_fields).toEqual([
        'name', 'type', 'price', 'description', 'privacy_settings'
      ]);
    });

    it('should have correct SERVICE_CONTENT_RESOURCE structure', () => {
      expect(SERVICE_CONTENT_RESOURCE.uri).toBe('agent://service-content');
      expect(SERVICE_CONTENT_RESOURCE.name).toBe('Service Content Management');
      expect(SERVICE_CONTENT_RESOURCE.description).toContain('Manage service content');
      expect(SERVICE_CONTENT_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(SERVICE_CONTENT_RESOURCE.content as string);
      expect(content).toHaveProperty('required_fields');
      expect(content.required_fields).toEqual([
        'service_id', 'content', 'version'
      ]);
    });

    it('should have correct SERVICE_PAYMENT_RESOURCE structure', () => {
      expect(SERVICE_PAYMENT_RESOURCE.uri).toBe('agent://service-payment');
      expect(SERVICE_PAYMENT_RESOURCE.name).toBe('Service Payment Processing');
      expect(SERVICE_PAYMENT_RESOURCE.description).toContain('Process payments');
      expect(SERVICE_PAYMENT_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(SERVICE_PAYMENT_RESOURCE.content as string);
      expect(content).toHaveProperty('required_fields');
      expect(content).toHaveProperty('note');
      expect(content.required_fields).toEqual(['service_id', 'amount']);
      expect(content.note).toContain('automatically handle');
    });

    it('should have correct SERVICE_DELIVERY_RESOURCE structure', () => {
      expect(SERVICE_DELIVERY_RESOURCE.uri).toBe('agent://service-delivery');
      expect(SERVICE_DELIVERY_RESOURCE.name).toBe('Service Delivery Management');
      expect(SERVICE_DELIVERY_RESOURCE.description).toContain('Track and manage');
      expect(SERVICE_DELIVERY_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(SERVICE_DELIVERY_RESOURCE.content as string);
      expect(content).toHaveProperty('required_fields');
      expect(content.required_fields).toEqual([
        'payment_message_id', 'service_id'
      ]);
    });

    it('should have correct DATA_REVELATION_RESOURCE structure', () => {
      expect(DATA_REVELATION_RESOURCE.uri).toBe('agent://data-revelation');
      expect(DATA_REVELATION_RESOURCE.name).toBe('Secure Data Revelation');
      expect(DATA_REVELATION_RESOURCE.description).toContain('Securely reveal');
      expect(DATA_REVELATION_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(DATA_REVELATION_RESOURCE.content as string);
      expect(content).toHaveProperty('security_features');
      expect(content.security_features).toEqual([
        'encryption', 'access_control', 'privacy_settings'
      ]);
    });

    it('should have correct AVAILABLE_TOOLS_RESOURCE structure', () => {
      expect(AVAILABLE_TOOLS_RESOURCE.uri).toBe('agent://available-tools');
      expect(AVAILABLE_TOOLS_RESOURCE.name).toBe('Available Tools');
      expect(AVAILABLE_TOOLS_RESOURCE.description).toContain('List of tools');
      expect(AVAILABLE_TOOLS_RESOURCE.mimeType).toBe('application/json');
      
      const content = JSON.parse(AVAILABLE_TOOLS_RESOURCE.content as string);
      expect(content).toHaveProperty('tool_categories');
      expect(content.tool_categories).toEqual([
        'authentication', 'marketplace', 'content', 'payment', 
        'delivery', 'feedback', 'management'
      ]);
    });
  });

  describe('RESOURCES array', () => {
    it('should contain all defined resources', () => {
      expect(RESOURCES).toHaveLength(8);
      expect(RESOURCES).toContain(DEFAULT_AGENT_RESOURCE);
      expect(RESOURCES).toContain(SERVICES_LIST_RESOURCE);
      expect(RESOURCES).toContain(SERVICE_REGISTRATION_RESOURCE);
      expect(RESOURCES).toContain(SERVICE_CONTENT_RESOURCE);
      expect(RESOURCES).toContain(SERVICE_PAYMENT_RESOURCE);
      expect(RESOURCES).toContain(SERVICE_DELIVERY_RESOURCE);
      expect(RESOURCES).toContain(DATA_REVELATION_RESOURCE);
      expect(RESOURCES).toContain(AVAILABLE_TOOLS_RESOURCE);
    });

    it('should have unique URIs for all resources', () => {
      const uris = RESOURCES.map(r => r.uri);
      const uniqueUris = new Set(uris);
      expect(uniqueUris.size).toBe(RESOURCES.length);
    });

    it('should have valid JSON content for all resources', () => {
      RESOURCES.forEach(resource => {
        expect(() => JSON.parse(resource.content as string)).not.toThrow();
      });
    });

    it('should have consistent structure for all resources', () => {
      RESOURCES.forEach(resource => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
        expect(resource).toHaveProperty('content');
        
        expect(typeof resource.uri).toBe('string');
        expect(typeof resource.name).toBe('string');
        expect(typeof resource.description).toBe('string');
        expect(typeof resource.mimeType).toBe('string');
        expect(typeof resource.content).toBe('string');
      });
    });
  });

  describe('handleListResources', () => {
    it('should return all resources', () => {
      const result = handleListResources();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(RESOURCES.length);
      expect(result).toEqual(RESOURCES);
    });

    it('should return resources with correct structure', () => {
      const result = handleListResources();
      
      result.forEach(resource => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
        expect(resource).toHaveProperty('content');
      });
    });

    it('should return the same resources as RESOURCES array', () => {
      const result = handleListResources();
      expect(result).toEqual(RESOURCES);
    });
  });

  describe('handleReadResource', () => {
    it('should return DEFAULT_AGENT_RESOURCE when requested', () => {
      const result = handleReadResource('agent://info');
      
      expect(result).toEqual(DEFAULT_AGENT_RESOURCE);
      expect(result.uri).toBe('agent://info');
    });

    it('should return SERVICES_LIST_RESOURCE when requested', () => {
      const result = handleReadResource('agent://services');
      
      expect(result).toEqual(SERVICES_LIST_RESOURCE);
      expect(result.uri).toBe('agent://services');
    });

    it('should return SERVICE_REGISTRATION_RESOURCE when requested', () => {
      const result = handleReadResource('agent://service-registration');
      
      expect(result).toEqual(SERVICE_REGISTRATION_RESOURCE);
      expect(result.uri).toBe('agent://service-registration');
    });

    it('should return SERVICE_CONTENT_RESOURCE when requested', () => {
      const result = handleReadResource('agent://service-content');
      
      expect(result).toEqual(SERVICE_CONTENT_RESOURCE);
      expect(result.uri).toBe('agent://service-content');
    });

    it('should return SERVICE_PAYMENT_RESOURCE when requested', () => {
      const result = handleReadResource('agent://service-payment');
      
      expect(result).toEqual(SERVICE_PAYMENT_RESOURCE);
      expect(result.uri).toBe('agent://service-payment');
    });

    it('should return SERVICE_DELIVERY_RESOURCE when requested', () => {
      const result = handleReadResource('agent://service-delivery');
      
      expect(result).toEqual(SERVICE_DELIVERY_RESOURCE);
      expect(result.uri).toBe('agent://service-delivery');
    });

    it('should return DATA_REVELATION_RESOURCE when requested', () => {
      const result = handleReadResource('agent://data-revelation');
      
      expect(result).toEqual(DATA_REVELATION_RESOURCE);
      expect(result.uri).toBe('agent://data-revelation');
    });

    it('should return AVAILABLE_TOOLS_RESOURCE with tools content when requested', () => {
      const result = handleReadResource('agent://available-tools');
      
      expect(result.uri).toBe('agent://available-tools');
      expect(result.name).toBe('Available Tools');
      expect(result.description).toBe('List of tools available for agent communication');
      expect(result.mimeType).toBe('application/json');
      
      const content = JSON.parse(result.content as string);
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBeGreaterThanOrEqual(2);
      expect(content.some((t: any) => t.name === 'status')).toBe(true);
      expect(content.some((t: any) => t.name === 'login')).toBe(true);
    });

    it('should throw AppError for unknown resource URI', () => {
      expect(() => handleReadResource('agent://unknown-resource')).toThrow(AppError);
      expect(() => handleReadResource('agent://unknown-resource')).toThrow('Resource not found: agent://unknown-resource');
    });

    it('should throw AppError with correct error code', () => {
      try {
        handleReadResource('agent://unknown-resource');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('RESOURCE_NOT_FOUND');
        expect((error as AppError).statusCode).toBe(404);
      }
    });

    it('should handle case-sensitive URI matching', () => {
      expect(() => handleReadResource('agent://INFO')).toThrow(AppError);
      expect(() => handleReadResource('agent://Info')).toThrow(AppError);
      expect(() => handleReadResource('AGENT://info')).toThrow(AppError);
    });

    it('should handle empty URI', () => {
      expect(() => handleReadResource('')).toThrow(AppError);
      expect(() => handleReadResource('')).toThrow('Resource not found: ');
    });

    it('should handle null URI', () => {
      expect(() => handleReadResource(null as any)).toThrow(AppError);
    });

    it('should handle undefined URI', () => {
      expect(() => handleReadResource(undefined as any)).toThrow(AppError);
    });
  });

  describe('Resource content validation', () => {
    it('should have valid JSON content in all resources', () => {
      RESOURCES.forEach(resource => {
        const content = JSON.parse(resource.content as string);
        expect(content).toBeDefined();
        expect(typeof content).toBe('object');
      });
    });

    it('should have consistent mime type across all resources', () => {
      RESOURCES.forEach(resource => {
        expect(resource.mimeType).toBe('application/json');
      });
    });

    it('should have non-empty names and descriptions', () => {
      RESOURCES.forEach(resource => {
        expect(resource.name.length).toBeGreaterThan(0);
        expect(resource.description?.length).toBeGreaterThan(0);
      });
    });

    it('should have valid URIs starting with agent://', () => {
      RESOURCES.forEach(resource => {
        expect(resource.uri).toMatch(/^agent:\/\/.+/);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle resources with special characters in content', () => {
      // Test that JSON parsing works with various content types
      RESOURCES.forEach(resource => {
        const content = JSON.parse(resource.content as string);
        expect(content).toBeDefined();
      });
    });

    it('should handle resources with nested objects in content', () => {
      const defaultResource = JSON.parse(DEFAULT_AGENT_RESOURCE.content as string);
      expect(defaultResource.capabilities).toBeDefined();
      expect(defaultResource.state).toBeDefined();
      expect(typeof defaultResource.capabilities).toBe('object');
      expect(typeof defaultResource.state).toBe('object');
    });

    it('should handle resources with arrays in content', () => {
      const servicesResource = JSON.parse(SERVICES_LIST_RESOURCE.content as string);
      expect(Array.isArray(servicesResource.filters)).toBe(true);
      expect(Array.isArray(servicesResource.service_types)).toBe(true);
    });
  });
}); 