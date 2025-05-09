import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { ToolHandler } from '../src/tools.js';
import { SupabaseService } from '../src/supabase/service.js';
import { EncryptionService } from '../src/encryption/service.js';
import { AuthService } from '../src/supabase/auth.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('ToolHandler', () => {
  let toolHandler: ToolHandler;
  let mockSupabaseService: SupabaseService;
  let mockEncryptionService: EncryptionService;
  let mockAuthService: AuthService;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Initialize services
    mockSupabaseService = new SupabaseService();
    mockEncryptionService = new EncryptionService();
    mockAuthService = AuthService.getInstance();

    // Create spies
    jest.spyOn(mockSupabaseService, 'listServices');
    jest.spyOn(mockSupabaseService, 'registerService');
    jest.spyOn(mockSupabaseService, 'cleanup');
    jest.spyOn(mockAuthService, 'getCurrentUserId');

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
      expect(tools).toHaveLength(5);
      expect(tools[0].name).toBe('listServices');
      expect(tools[1].name).toBe('registerService');
      expect(tools[2].name).toBe('servicePayment');
      expect(tools[3].name).toBe('serviceDelivery');
      expect(tools[4].name).toBe('revealData');
    });
  });

  describe('handleToolCall', () => {
    it('should throw error for unknown tool', async () => {
      await expect(toolHandler.handleToolCall('unknownTool', {}))
        .rejects
        .toThrow(new McpError(ErrorCode.InvalidParams, 'Unknown tool: unknownTool'));
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
    });

    describe('servicePayment', () => {
      it('should throw not implemented error', async () => {
        await expect(toolHandler.handleToolCall('servicePayment', {
          serviceId: '1',
          amount: '100'
        })).rejects.toThrow('Not implemented: Service payment');
      });
    });

    describe('serviceDelivery', () => {
      it('should throw not implemented error', async () => {
        await expect(toolHandler.handleToolCall('serviceDelivery', {
          serviceId: '1',
          data: {}
        })).rejects.toThrow('Not implemented: Service delivery');
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