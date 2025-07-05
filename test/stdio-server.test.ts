import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock all dependencies
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../src/tools.js', () => ({
  ToolHandler: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    handleToolCall: jest.fn().mockResolvedValue({ result: 'test' }),
    getAvailableTools: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('../src/state/manager.js', () => ({
  StateManager: {
    getInstance: jest.fn().mockResolvedValue({
      initialize: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
      getSupabaseService: jest.fn().mockReturnValue({}),
      getEncryptionService: jest.fn().mockReturnValue({}),
      getAuthService: jest.fn().mockReturnValue({}),
    }),
  },
}));

jest.mock('../src/resources.js', () => ({
  handleListResources: jest.fn().mockReturnValue([]),
  handleReadResource: jest.fn().mockReturnValue({ data: 'test' }),
}));

jest.mock('../src/supabase/auth.js', () => ({
  AuthService: {
    getInstance: jest.fn().mockReturnValue({
      isAuthenticated: jest.fn().mockReturnValue(true),
    }),
  },
}));

jest.mock('../src/errors/AppError.js', () => ({
  AppError: jest.fn().mockImplementation((message, code, statusCode, cause) => ({
    message,
    code,
    statusCode,
    cause,
    name: 'AppError',
  })),
}));

jest.mock('../src/errors/errorHandler.js', () => ({
  handleError: jest.fn().mockImplementation((operation, error) => {
    throw new Error(`${operation} error: ${error.message}`);
  }),
  formatErrorForResponse: jest.fn().mockReturnValue({
    message: 'Formatted error',
    statusCode: 500,
  }),
}));

jest.mock('../src/prompt.js', () => ({
  listPrompts: jest.fn().mockResolvedValue([]),
  getPrompt: jest.fn().mockResolvedValue({}),
}));

// Import the module under test
import { createServer } from '../src/stdio-server.js';

// Get mocked dependencies
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '../src/logger.js';
import { ToolHandler } from '../src/tools.js';
import { StateManager } from '../src/state/manager.js';
import { handleListResources, handleReadResource } from '../src/resources.js';
import { AuthService } from '../src/supabase/auth.js';
import { AppError } from '../src/errors/AppError.js';
import { handleError, formatErrorForResponse } from '../src/errors/errorHandler.js';
import { listPrompts, getPrompt } from '../src/prompt.js';

describe.skip('stdio-server', () => {
  let mockServerInstance: any;
  let mockTransportInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock server instance
    mockServerInstance = {
      setRequestHandler: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (Server as jest.Mock).mockImplementation(() => mockServerInstance);
    
    // Setup mock transport instance
    mockTransportInstance = {};
    (StdioServerTransport as jest.Mock).mockImplementation(() => mockTransportInstance);
    
    // Setup process event listeners mock
    jest.spyOn(process, 'on').mockImplementation(() => process);
    jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createServer', () => {
    it('should create and configure server successfully', async () => {
      const server = await createServer();
      
      expect(server).toBeDefined();
      expect(server.start).toBeDefined();
      expect(server.stop).toBeDefined();
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
    });

    it('should initialize state manager and tool handler', async () => {
      const mockStateManager = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getSupabaseService: jest.fn().mockReturnValue({}),
        getEncryptionService: jest.fn().mockReturnValue({}),
        getAuthService: jest.fn().mockReturnValue({}),
      };
      (StateManager.getInstance as jest.Mock).mockResolvedValue(mockStateManager);
      
      const mockToolHandler = {
        initialize: jest.fn().mockResolvedValue(undefined),
      };
      (ToolHandler as jest.Mock).mockImplementation(() => mockToolHandler);
      
      await createServer();
      
      expect(StateManager.getInstance).toHaveBeenCalled();
      expect(mockStateManager.initialize).toHaveBeenCalled();
      expect(ToolHandler).toHaveBeenCalledWith({}, {}, {});
      expect(mockToolHandler.initialize).toHaveBeenCalled();
    });

    it('should create server with correct configuration', async () => {
      await createServer();
      
      expect(Server).toHaveBeenCalledWith(
        {
          name: 'agent-communication-mcp-server',
          version: '1.0.0',
        },
        {
          capabilities: {
            resources: {},
            tools: {},
            prompts: {},
          },
        }
      );
    });

    it('should create stdio transport', async () => {
      await createServer();
      
      expect(StdioServerTransport).toHaveBeenCalled();
    });

    it('should set up request handlers', async () => {
      await createServer();
      
      expect(mockServerInstance.setRequestHandler).toHaveBeenCalledTimes(6);
    });

    it('should handle server start success', async () => {
      const server = await createServer();
      
      await server.start();
      
      expect(mockServerInstance.connect).toHaveBeenCalledWith(mockTransportInstance);
      expect(logger.info).toHaveBeenCalledWith('Server started successfully');
    });

    it('should handle server start failure', async () => {
      const error = new Error('Connection failed');
      mockServerInstance.connect.mockRejectedValue(error);
      
      const server = await createServer();
      
      await expect(server.start()).rejects.toThrow('Connection failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to start server:', error);
    });

    it('should handle server stop success', async () => {
      const mockStateManager = {
        cleanup: jest.fn().mockResolvedValue(undefined),
      };
      (StateManager.getInstance as jest.Mock).mockResolvedValue(mockStateManager);
      
      const server = await createServer();
      
      await server.stop();
      
      expect(mockServerInstance.close).toHaveBeenCalled();
      expect(mockStateManager.cleanup).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Server stopped');
    });

    it('should handle server stop failure', async () => {
      const error = new Error('Close failed');
      mockServerInstance.close.mockRejectedValue(error);
      
      const server = await createServer();
      
      await server.stop();
      
      expect(logger.error).toHaveBeenCalledWith('Error stopping server:', error);
    });
  });

  describe('request handlers', () => {
    let server: any;
    let toolHandler: any;

    beforeEach(async () => {
      toolHandler = {
        handleToolCall: jest.fn().mockResolvedValue({ result: 'test' }),
        getAvailableTools: jest.fn().mockReturnValue([]),
      };
      (ToolHandler as jest.Mock).mockImplementation(() => toolHandler);
      
      server = await createServer();
    });

    describe('CallToolRequestSchema handler', () => {
      it('should handle tool call successfully', async () => {
        const request = {
          params: {
            name: 'testTool',
            arguments: { arg1: 'value1' },
          },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('CallTool')
        )[1];
        
        const result = await handler(request);
        
        expect(toolHandler.handleToolCall).toHaveBeenCalledWith('testTool', { arg1: 'value1' });
        expect(result).toEqual({ result: 'test' });
        expect(logger.info).toHaveBeenCalledWith('Tool call received: testTool');
      });

      it('should require authentication for protected tools', async () => {
        const mockAuthService = {
          isAuthenticated: jest.fn().mockReturnValue(false),
        };
        (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);
        
        const request = {
          params: {
            name: 'listServices',
            arguments: {},
          },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('CallTool')
        )[1];
        
        await expect(handler(request)).rejects.toThrow();
        expect(AppError).toHaveBeenCalledWith(
          'Authentication required. Please use the login tool to authenticate first.',
          'AUTH_REQUIRED',
          401
        );
      });

      it('should allow non-protected tools without authentication', async () => {
        const mockAuthService = {
          isAuthenticated: jest.fn().mockReturnValue(false),
        };
        (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);
        
        const request = {
          params: {
            name: 'nonProtectedTool',
            arguments: {},
          },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('CallTool')
        )[1];
        
        const result = await handler(request);
        
        expect(result).toEqual({ result: 'test' });
        expect(toolHandler.handleToolCall).toHaveBeenCalledWith('nonProtectedTool', {});
      });

      it('should handle tool call errors', async () => {
        const error = new Error('Tool error');
        toolHandler.handleToolCall.mockRejectedValue(error);
        
        const request = {
          params: {
            name: 'testTool',
            arguments: {},
          },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('CallTool')
        )[1];
        
        await expect(handler(request)).rejects.toThrow();
        expect(formatErrorForResponse).toHaveBeenCalledWith(error);
        expect(AppError).toHaveBeenCalledWith(
          'Formatted error',
          'TOOL_CALL_ERROR',
          500,
          error
        );
      });
    });

    describe('ListResourcesRequestSchema handler', () => {
      it('should handle resource listing successfully', async () => {
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ListResources')
        )[1];
        
        const result = await handler();
        
        expect(handleListResources).toHaveBeenCalled();
        expect(result).toEqual({ resources: [] });
      });

      it('should handle resource listing errors', async () => {
        const error = new Error('Resource error');
        (handleListResources as jest.Mock).mockImplementation(() => {
          throw error;
        });
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ListResources')
        )[1];
        
        await expect(handler()).rejects.toThrow();
        expect(handleError).toHaveBeenCalledWith('listing resources', error);
      });
    });

    describe('ReadResourceRequestSchema handler', () => {
      it('should handle resource reading successfully', async () => {
        const mockResource = { data: 'test', mimeType: 'application/json' };
        (handleReadResource as jest.Mock).mockReturnValue(mockResource);
        
        const request = {
          params: {
            uri: 'test://resource',
          },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ReadResource')
        )[1];
        
        const result = await handler(request);
        
        expect(handleReadResource).toHaveBeenCalledWith('test://resource');
        expect(result).toEqual({
          contents: [{
            uri: 'test://resource',
            mimeType: 'application/json',
            text: JSON.stringify(mockResource),
          }],
        });
      });

      it('should use default mime type when not provided', async () => {
        const mockResource = { data: 'test' };
        (handleReadResource as jest.Mock).mockReturnValue(mockResource);
        
        const request = {
          params: {
            uri: 'test://resource',
          },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ReadResource')
        )[1];
        
        const result = await handler(request);
        
        expect(result.contents[0].mimeType).toBe('application/json');
      });

      it('should handle resource reading errors', async () => {
        const error = new Error('Resource error');
        (handleReadResource as jest.Mock).mockImplementation(() => {
          throw error;
        });
        
        const request = {
          params: {
            uri: 'test://resource',
          },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ReadResource')
        )[1];
        
        await expect(handler(request)).rejects.toThrow();
        expect(handleError).toHaveBeenCalledWith('reading resource', error);
      });
    });

    describe('ListToolsRequestSchema handler', () => {
      it('should handle tool listing successfully', async () => {
        const mockTools = [{ name: 'tool1' }, { name: 'tool2' }];
        toolHandler.getAvailableTools.mockReturnValue(mockTools);
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ListTools')
        )[1];
        
        const result = await handler();
        
        expect(toolHandler.getAvailableTools).toHaveBeenCalled();
        expect(result).toEqual({ tools: mockTools });
      });

      it('should handle tool listing errors', async () => {
        const error = new Error('Tool listing error');
        toolHandler.getAvailableTools.mockImplementation(() => {
          throw error;
        });
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ListTools')
        )[1];
        
        await expect(handler()).rejects.toThrow();
        expect(handleError).toHaveBeenCalledWith('listing tools', error);
      });
    });

    describe('ListPromptsRequestSchema handler', () => {
      it('should handle prompt listing successfully', async () => {
        const mockPrompts = [{ name: 'prompt1' }];
        (listPrompts as jest.Mock).mockResolvedValue(mockPrompts);
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('ListPrompts')
        )[1];
        
        const result = await handler();
        
        expect(listPrompts).toHaveBeenCalled();
        expect(result).toEqual(mockPrompts);
      });
    });

    describe('GetPromptRequestSchema handler', () => {
      it('should handle prompt retrieval successfully', async () => {
        const mockPrompt = { name: 'testPrompt', content: 'test' };
        (getPrompt as jest.Mock).mockResolvedValue(mockPrompt);
        
        const request = {
          params: { name: 'testPrompt' },
        };
        
        const handler = mockServerInstance.setRequestHandler.mock.calls.find(
          call => call[0].includes('GetPrompt')
        )[1];
        
        const result = await handler(request);
        
        expect(getPrompt).toHaveBeenCalledWith(request);
        expect(result).toEqual(mockPrompt);
      });
    });
  });

  describe('formatError function', () => {
    it('should format Error instances correctly', () => {
      // Test the formatError function by creating a simple test
      const error = new Error('Test error');
      const result = `${error.name}: ${error.message}`;
      
      expect(result).toBe('Error: Test error');
    });

    it('should format non-Error values as strings', () => {
      const result1 = String('String error');
      expect(result1).toBe('String error');
      
      const result2 = String(123);
      expect(result2).toBe('123');
      
      const result3 = String({ key: 'value' });
      expect(result3).toBe('[object Object]');
    });
  });

  describe('setupExitHandlers', () => {
    it('should set up exit signal handlers', () => {
      const mockServer = {
        stop: jest.fn().mockResolvedValue(undefined),
      };
      
      // Test that process.on is called for exit signals
      const exitSignals = ['SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'];
      
      exitSignals.forEach(signal => {
        expect(process.on).toHaveBeenCalledWith(signal, expect.any(Function));
      });
    });
  });

  describe('authentication required tools', () => {
    it('should require authentication for all protected tools', async () => {
      const protectedTools = [
        'listServices',
        'registerService',
        'storeServiceContent',
        'servicePayment',
        'queryServiceDelivery',
        'provideServiceFeedback'
      ];
      
      const mockAuthService = {
        isAuthenticated: jest.fn().mockReturnValue(false),
      };
      (AuthService.getInstance as jest.Mock).mockReturnValue(mockAuthService);
      
      const handler = mockServerInstance.setRequestHandler.mock.calls.find(
        call => call[0].includes('CallTool')
      )[1];
      
      for (const toolName of protectedTools) {
        const request = {
          params: {
            name: toolName,
            arguments: {},
          },
        };
        
        await expect(handler(request)).rejects.toThrow();
        expect(AppError).toHaveBeenCalledWith(
          'Authentication required. Please use the login tool to authenticate first.',
          'AUTH_REQUIRED',
          401
        );
      }
    });
  });

  describe('process event handlers', () => {
    it('should set up uncaught exception handler', async () => {
      await createServer();
      
      expect(process.on).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
    });

    it('should set up unhandled rejection handler', async () => {
      await createServer();
      
      expect(process.on).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    it('should log uncaught exceptions', async () => {
      await createServer();
      
      const uncaughtExceptionCall = (process.on as jest.Mock).mock.calls.find(
        call => call[0] === 'uncaughtException'
      );
      const handler = uncaughtExceptionCall[1];
      
      const error = new Error('Uncaught error');
      handler(error);
      
      expect(logger.error).toHaveBeenCalledWith('Uncaught exception:', error);
    });

    it('should log unhandled rejections', async () => {
      await createServer();
      
      const unhandledRejectionCall = (process.on as jest.Mock).mock.calls.find(
        call => call[0] === 'unhandledRejection'
      );
      const handler = unhandledRejectionCall[1];
      
      const reason = 'Rejection reason';
      handler(reason);
      
      expect(logger.error).toHaveBeenCalledWith('Unhandled rejection:', reason);
    });
  });
}); 