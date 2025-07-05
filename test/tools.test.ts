// @ts-nocheck
// Mock the wallet API before any imports
jest.mock('../src/api/wallet-api.js', () => ({
  sendFunds: jest.fn()
}));

import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { ToolHandler } from '../src/tools.js';
import { SupabaseService } from '../src/supabase/service.js';
import { EncryptionService } from '../src/encryption/service.js';
import { AuthService } from '../src/supabase/auth.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { StateManager } from '../src/state/manager.js';
import { validateService } from '../src/validation/service.js';
import { Service } from '../src/supabase/config.js';
import { SERVICE_PRIVACY_LEVELS } from '../src/supabase/message-types.js';
import { ServiceContentStorage, ServiceContent } from '../src/storage/service-content.js';
import { MESSAGE_TOPICS, MESSAGE_PURPOSE, CONTENT_TYPES } from '../src/supabase/message-types.js';
import { TRANSACTION_TYPES, MESSAGE_STATUS } from '../src/supabase/message-types.js';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/hashes/utils';
import * as walletApi from '../src/api/wallet-api.js';

// Mock the validation module
jest.mock('../src/validation/service.js', () => ({
  validateService: jest.fn()
}));

describe.skip('ToolHandler', () => {
  let toolHandler: ToolHandler;
  let mockSupabaseService: SupabaseService;
  let mockEncryptionService: EncryptionService;
  let mockAuthService: AuthService;
  let mockStateManager: StateManager;
  let testPrivateKey: Uint8Array;
  let testPublicKey: Uint8Array;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Generate test X25519 key pair
    testPrivateKey = randomBytes(32);
    testPublicKey = x25519.getPublicKey(testPrivateKey);

    // Mock environment variables for encryption
    process.env.AGENT_PRIVATE_KEY = Buffer.from(testPrivateKey).toString('base64');
    process.env.AGENT_PUBLIC_KEY = Buffer.from(testPublicKey).toString('base64');

    // Create mock services
    mockSupabaseService = {
      cleanup: jest.fn(),
      listServices: jest.fn(),
      registerService: jest.fn(),
      getServiceById: jest.fn(),
      sendMessage: jest.fn(),
      getMessageById: jest.fn(),
      checkServiceDelivery: jest.fn(),
      getSupabaseClient: jest.fn().mockReturnValue({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null })
            })
          })
        })
      })
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
    jest.spyOn(StateManager, 'getInstance').mockResolvedValue(mockStateManager);

    // Create ToolHandler instance with services
    toolHandler = new ToolHandler(
      mockSupabaseService,
      mockEncryptionService,
      mockAuthService
    );

    // Initialize the tool handler
    await toolHandler.initialize();

    // Mock sendFunds to return success
    (walletApi.sendFunds as any).mockResolvedValue({ success: true, transactionId: 'tx123' });
  });

  afterAll(async () => {
    // Clean up any remaining async operations
    await toolHandler.cleanup();
    jest.restoreAllMocks();
  });

  describe('getAvailableTools', () => {
    it('should return all available tools', () => {
      const tools = toolHandler.getAvailableTools();
      expect(tools).toHaveLength(9);
      expect(tools[0].name).toBe('status');
      expect(tools[1].name).toBe('login');
      expect(tools[2].name).toBe('listServices');
      expect(tools[3].name).toBe('registerService');
      expect(tools[4].name).toBe('storeServiceContent');
      expect(tools[5].name).toBe('servicePayment');
      expect(tools[6].name).toBe('queryServiceDelivery');
      expect(tools[7].name).toBe('provideServiceFeedback');
      expect(tools[8].name).toBe('disableService');
    });
  });

  describe('handleToolCall', () => {
    it('should throw error for unknown tool', async () => {
      await expect(toolHandler.handleToolCall('unknownTool', {}))
        .rejects
        .toThrow('Unknown tool: unknownTool');
    });

    it('should ensure system is ready before handling tool calls', async () => {
      // Mock authentication for this test
      jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue('user123');
      jest.spyOn(mockSupabaseService, 'listServices').mockResolvedValue([]);
      
      await toolHandler.handleToolCall('listServices', {});
      expect(mockStateManager.ensureReadyWithRecovery).toHaveBeenCalled();
    });

    describe('listServices', () => {
      it('should return list of services', async () => {
        // Mock authentication for this test
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue('user123');
        
        const mockServices: Service[] = [{
          id: '1',
          name: 'Test Service',
          agent_id: 'user123',
          type: 'test',
          example: 'Test example',
          price: 100,
          description: 'Test description',
          midnight_wallet_address: 'test_wallet_address_12345678901234567890123456789012',
          status: 'active' as const,
          connection_status: 'connected' as const,
          privacy_settings: {
            privacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
            conditions: {
              text: 'Service terms and conditions...',
              privacy: SERVICE_PRIVACY_LEVELS.PUBLIC
            }
          }
        }];
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
        example: 'Test example',
        midnight_wallet_address: 'test_wallet_address_12345678901234567890123456789012',
        privacy_settings: {
          privacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
          conditions: {
            text: 'Service terms and conditions...',
            privacy: SERVICE_PRIVACY_LEVELS.PRIVATE
          }
        }
      };

      it('should register a new service with privacy settings successfully', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'registerService').mockResolvedValue({
          id: '1',
          agent_id: mockUserId,
          ...validServiceData,
          status: 'active',
          connection_status: 'connected'
        });

        const result = await toolHandler.handleToolCall('registerService', validServiceData);

        expect(result.content[0].type).toBe('text');
        const registeredService = JSON.parse(result.content[0].text);
        expect(registeredService).toEqual({
          id: '1',
          agent_id: mockUserId,
          ...validServiceData,
          status: 'active',
          connection_status: 'connected'
        });
        expect(registeredService.privacy_settings).toEqual(validServiceData.privacy_settings);
        expect(mockSupabaseService.registerService).toHaveBeenCalledWith({
          agent_id: mockUserId,
          ...validServiceData
        });
      });

      it('should throw error when user is not authenticated', async () => {
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(null);

        await expect(toolHandler.handleToolCall('registerService', validServiceData))
          .rejects
          .toThrow('No authenticated agent found');
      });

      it('should throw error when service validation fails', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'registerService').mockRejectedValue(
          new Error('Invalid service data')
        );

        await expect(toolHandler.handleToolCall('registerService', validServiceData))
          .rejects
          .toThrow('Invalid service data');
      });
    });

    describe('storeServiceContent', () => {
      const validContentData = {
        serviceId: '1',
        content: { test: 'data' },
        version: '1.0.0',
        tags: ['test']
      };

      const mockService = {
        id: '1',
        agent_id: 'user123',
        name: 'Test Service',
        type: 'CUSTOM',
        price: 100,
        description: 'Test description',
        example: 'Test example',
        midnight_wallet_address: 'test_wallet_address_12345678901234567890123456789012',
        status: 'active' as const,
        connection_status: 'connected' as const,
        privacy_settings: {
          privacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
          conditions: {
            text: 'Service terms and conditions...',
            privacy: SERVICE_PRIVACY_LEVELS.PUBLIC
          }
        }
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
          .toThrow('Service with ID 1 not found');
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
          .toThrow('You can only store content for your own services');
      });
    });

    describe('servicePayment', () => {
      const mockService = {
        id: '1',
        agent_id: 'different-user',
        name: 'Test Service',
        type: 'CUSTOM',
        price: 100,
        description: 'Test description',
        example: 'Test example',
        midnight_wallet_address: 'test_wallet_address_12345678901234567890123456789012',
        status: 'active' as const,
        connection_status: 'connected' as const,
        privacy_settings: {
          privacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
          conditions: {
            text: 'Service terms and conditions...',
            privacy: SERVICE_PRIVACY_LEVELS.PRIVATE
          }
        }
      };

      it('should handle private payment correctly', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(mockService);
        jest.spyOn(mockSupabaseService, 'sendMessage').mockResolvedValue({
          id: '1',
          sender_agent_id: mockUserId,
          recipient_agent_id: mockService.agent_id,
          conversation_id: 'test-conversation-id',
          public: {
            topic: MESSAGE_TOPICS.PAYMENT,
            serviceId: mockService.id,
            content: {
              type: CONTENT_TYPES.TRANSACTION,
              data: {
                type: TRANSACTION_TYPES.PAYMENT_NOTIFICATION,
                status: MESSAGE_STATUS.PENDING,
                service_name: mockService.name,
                timestamp: new Date().toISOString()
              },
              metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                extra: {
                  purpose: MESSAGE_PURPOSE.PAYMENT_NOTIFICATION
                }
              }
            }
          },
          private: {
            encryptedMessage: {
              nonce: 'test-nonce',
              ciphertext: 'test-ciphertext',
              tag: 'test-tag'
            },
            encryptedKeys: {
              recipient: 'test-recipient-key',
              auditor: 'test-auditor-key'
            }
          },
          created_at: new Date().toISOString()
        });

        const result = await toolHandler.handleToolCall('servicePayment', {
          serviceId: '1',
          amount: '100'
        });

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse(result.content[0].text);
        expect(response.amount).toBe('[PRIVATE]');
        expect(response.status).toBe('success');
      });

      it('should handle public payment correctly', async () => {
        const mockUserId = 'user123';
        const publicService = {
          ...mockService,
          privacy_settings: {
            ...mockService.privacy_settings,
            privacy: SERVICE_PRIVACY_LEVELS.PUBLIC
          }
        };
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(publicService);
        jest.spyOn(mockSupabaseService, 'sendMessage').mockResolvedValue({
          id: '1',
          sender_agent_id: mockUserId,
          recipient_agent_id: publicService.agent_id,
          conversation_id: 'test-conversation-id',
          public: {
            topic: MESSAGE_TOPICS.PAYMENT,
            serviceId: publicService.id,
            content: {
              type: CONTENT_TYPES.TRANSACTION,
              data: {
                type: TRANSACTION_TYPES.PAYMENT_NOTIFICATION,
                status: MESSAGE_STATUS.PENDING,
                service_name: publicService.name,
                timestamp: new Date().toISOString()
              },
              metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                extra: {
                  purpose: MESSAGE_PURPOSE.PAYMENT_NOTIFICATION
                }
              }
            }
          },
          private: {
            encryptedMessage: {
              nonce: 'test-nonce',
              ciphertext: 'test-ciphertext',
              tag: 'test-tag'
            },
            encryptedKeys: {
              recipient: 'test-recipient-key',
              auditor: 'test-auditor-key'
            }
          },
          created_at: new Date().toISOString()
        });

        const result = await toolHandler.handleToolCall('servicePayment', {
          serviceId: '1',
          amount: '100'
        });

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse(result.content[0].text);
        expect(response.amount).toBe('100');
        expect(response.status).toBe('success');
      });

      it('should throw error when user is not authenticated', async () => {
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(null);

        await expect(toolHandler.handleToolCall('servicePayment', {
          serviceId: '1',
          amount: '100'
        })).rejects.toThrow('No authenticated agent found');
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