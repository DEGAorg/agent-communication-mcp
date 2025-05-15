import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { ToolHandler } from '../src/tools.js';
import { SupabaseService } from '../src/supabase/service.js';
import { EncryptionService } from '../src/encryption/service.js';
import { AuthService } from '../src/supabase/auth.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { StateManager } from '../src/state/manager.js';
import { validateService } from '../src/validation/service.js';
import { Service } from '../src/supabase/config.js';

// Mock the validation module
jest.mock('../src/validation/service.js', () => ({
  validateService: jest.fn()
}));

describe('ToolHandler', () => {
  let toolHandler: ToolHandler;
  let mockSupabaseService: SupabaseService;
  let mockEncryptionService: EncryptionService;
  let mockAuthService: AuthService;
  let mockStateManager: StateManager;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Initialize services
    mockSupabaseService = {
      listServices: jest.fn(),
      registerService: jest.fn(),
      getServiceById: jest.fn(),
      cleanup: jest.fn()
    } as unknown as SupabaseService;

    mockEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn()
    } as unknown as EncryptionService;

    mockAuthService = {
      getCurrentUserId: jest.fn()
    } as unknown as AuthService;

    mockStateManager = {
      ensureReadyWithRecovery: jest.fn().mockImplementation(() => Promise.resolve())
    } as unknown as StateManager;

    // Mock StateManager.getInstance
    jest.spyOn(StateManager, 'getInstance').mockReturnValue(mockStateManager);

    // Create ToolHandler instance with services
    toolHandler = new ToolHandler(
      mockSupabaseService,
      mockEncryptionService,
      mockAuthService
    );
  });

  afterAll(async () => {
    // Clean up any remaining async operations
    await toolHandler.cleanup();
    jest.restoreAllMocks();
  });

  describe('getAvailableTools', () => {
    it('should return all available tools', () => {
      const tools = toolHandler.getAvailableTools();
      expect(tools).toHaveLength(6);
      expect(tools[0].name).toBe('listServices');
      expect(tools[1].name).toBe('registerService');
      expect(tools[2].name).toBe('storeServiceContent');
      expect(tools[3].name).toBe('servicePayment');
      expect(tools[4].name).toBe('serviceDelivery');
      expect(tools[5].name).toBe('revealData');
    });
  });

  describe('handleToolCall', () => {
    it('should throw error for unknown tool', async () => {
      await expect(toolHandler.handleToolCall('unknownTool', {}))
        .rejects
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Unknown tool: unknownTool'));
    });

    it('should ensure system is ready before handling tool calls', async () => {
      await toolHandler.handleToolCall('listServices', {});
      expect(mockStateManager.ensureReadyWithRecovery).toHaveBeenCalled();
    });

    describe('listServices', () => {
      it('should return list of services', async () => {
        const mockServices = [{ id: '1', name: 'Test Service', agent_id: 'user123', type: 'test', example: 'Test example', price: 100, description: 'Test description' }];
        jest.spyOn(mockSupabaseService, 'listServices').mockResolvedValue(mockServices);

        const result = await toolHandler.handleToolCall('listServices', {});
        
        expect(result).toEqual({
          content: [{
            type: 'text',
            text: JSON.stringify(mockServices, null, 2),
            mimeType: 'application/json'
          }]
        });
        expect(mockSupabaseService.listServices).toHaveBeenCalled();
      });
    });

    describe('registerService', () => {
      const validServiceData = {
        name: 'Test Service',
        type: 'CUSTOM',
        price: 100,
        description: 'Test description that is at least 10 characters long',
        example: 'Test example'
      };

      it('should register a new service successfully', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'registerService').mockResolvedValue({
          id: '1',
          agent_id: mockUserId,
          ...validServiceData
        });

        const result = await toolHandler.handleToolCall('registerService', validServiceData);

        expect(result.content[0].type).toBe('text');
        expect(JSON.parse(result.content[0].text)).toEqual({
          id: '1',
          agent_id: mockUserId,
          ...validServiceData
        });
        expect(mockSupabaseService.registerService).toHaveBeenCalledWith({
          agent_id: mockUserId,
          ...validServiceData
        });
      });

      it('should throw error when user is not authenticated', async () => {
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(null);

        await expect(toolHandler.handleToolCall('registerService', validServiceData))
          .rejects
          .toThrow(new McpError(ErrorCode.InvalidParams, 'No authenticated agent found'));
      });

      it('should throw error when service validation fails', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'registerService').mockRejectedValue(
          new McpError(ErrorCode.InvalidParams, 'Invalid service data')
        );

        await expect(toolHandler.handleToolCall('registerService', validServiceData))
          .rejects
          .toThrow(new McpError(ErrorCode.InvalidParams, 'Invalid service data'));
      });
    });

    describe('storeServiceContent', () => {
      const validContentData = {
        serviceId: '1',
        content: { test: 'data' },
        version: '1.0.0',
        tags: ['test']
      };

      const mockService: Service = {
        id: '1',
        agent_id: 'user123',
        name: 'Test Service',
        type: 'CUSTOM',
        price: 100,
        description: 'Test description',
        example: 'Test example'
      };

      it('should store service content successfully', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(mockService);

        await toolHandler.handleToolCall('storeServiceContent', validContentData);

        expect(mockSupabaseService.getServiceById).toHaveBeenCalledWith('1');
      });

      it('should throw error when service does not exist', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(null);

        await expect(toolHandler.handleToolCall('storeServiceContent', validContentData))
          .rejects
          .toThrow(new McpError(ErrorCode.InvalidParams, 'Service with ID 1 not found'));
      });

      it('should throw error when user is not the service owner', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue({
          ...mockService,
          agent_id: 'different-user'
        });

        await expect(toolHandler.handleToolCall('storeServiceContent', validContentData))
          .rejects
          .toThrow(new McpError(ErrorCode.InvalidParams, 'You can only store content for your own services'));
      });
    });

    describe('servicePayment', () => {
      it('should throw error when user is not authenticated', async () => {
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(null);

        await expect(toolHandler.handleToolCall('servicePayment', {
          serviceId: '1',
          amount: '100'
        })).rejects.toThrow(new McpError(ErrorCode.InvalidParams, 'No authenticated agent found'));
      });

      it('should handle service payment when authenticated', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue({
          id: '1',
          agent_id: 'different-user',
          name: 'Test Service',
          type: 'CUSTOM',
          price: 100,
          description: 'Test description',
          example: 'Test example'
        });

        await expect(toolHandler.handleToolCall('servicePayment', {
          serviceId: '1',
          amount: '100'
        })).rejects.toThrow(new McpError(ErrorCode.InternalError, 'Failed to process service payment: u coordinate of length 32 expected, got 15'));
      });
    });

    describe('serviceDelivery', () => {
      it('should throw error when user is not authenticated', async () => {
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(null);

        await expect(toolHandler.handleToolCall('serviceDelivery', {
          serviceId: '1',
          data: {}
        })).rejects.toThrow(new McpError(ErrorCode.InvalidParams, 'No authenticated agent found'));
      });

      it('should handle service delivery when authenticated', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue({
          id: '1',
          agent_id: 'different-user',
          name: 'Test Service',
          type: 'CUSTOM',
          price: 100,
          description: 'Test description',
          example: 'Test example'
        });

        await expect(toolHandler.handleToolCall('serviceDelivery', {
          serviceId: '1',
          data: {}
        })).rejects.toThrow(new McpError(ErrorCode.InternalError, 'Failed to deliver service content: u coordinate of length 32 expected, got 15'));
      });
    });

    describe('revealData', () => {
      it('should throw not implemented error', async () => {
        await expect(toolHandler.handleToolCall('revealData', {
          messageId: '1'
        })).rejects.toThrow('Not implemented: Data revelation');
      });
    });
  });

  describe('cleanup', () => {
    it('should call cleanup on supabase service', async () => {
      await toolHandler.cleanup();
      expect(mockSupabaseService.cleanup).toHaveBeenCalled();
    });
  });
}); 