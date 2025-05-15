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
  let testPrivateKey: Uint8Array;
  let testPublicKey: Uint8Array;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Generate test X25519 key pair
    testPrivateKey = randomBytes(32);
    testPublicKey = x25519.getPublicKey(testPrivateKey);

    // Mock environment variables for encryption
    process.env.AGENT_PRIVATE_KEY = Buffer.from(testPrivateKey).toString('base64');
    process.env.AGENT_PUBLIC_KEY = Buffer.from(testPublicKey).toString('base64');

    // Initialize services
    mockSupabaseService = {
      listServices: jest.fn(),
      registerService: jest.fn(),
      getServiceById: jest.fn(),
      cleanup: jest.fn(),
      sendMessage: jest.fn()
    } as unknown as SupabaseService;

    mockEncryptionService = {
      encryptMessageForRecipients: jest.fn().mockImplementation(async (message, recipientPublicKey, auditorPublicKey, senderPrivateKey) => {
        // For testing purposes, we'll just return a mock encrypted message
        return {
          encryptedMessage: {
            nonce: 'test-nonce',
            ciphertext: 'test-ciphertext',
            tag: 'test-tag'
          },
          encryptedKeys: {
            recipient: 'test-recipient-key',
            auditor: 'test-auditor-key'
          }
        };
      }),
      decryptMessage: jest.fn().mockImplementation(async (encryptedMessage, encryptedKey, senderPublicKey, recipientPrivateKey) => {
        // For testing purposes, return a mock decrypted message
        return JSON.stringify({ amount: '100' });
      }),
      getPublicKey: jest.fn().mockReturnValue(Buffer.alloc(32)) // Return a 32-byte buffer as public key
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
        const mockServices: Service[] = [{
          id: '1',
          name: 'Test Service',
          agent_id: 'user123',
          type: 'test',
          example: 'Test example',
          price: 100,
          description: 'Test description',
          privacy_settings: {
            contentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
            paymentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
            deliveryPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
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
        privacy_settings: {
          contentPrivacy: SERVICE_PRIVACY_LEVELS.MIXED,
          paymentPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
          deliveryPrivacy: SERVICE_PRIVACY_LEVELS.MIXED,
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
          ...validServiceData
        });

        const result = await toolHandler.handleToolCall('registerService', validServiceData);

        expect(result.content[0].type).toBe('text');
        const registeredService = JSON.parse(result.content[0].text);
        expect(registeredService).toEqual({
          id: '1',
          agent_id: mockUserId,
          ...validServiceData
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
        example: 'Test example',
        privacy_settings: {
          contentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
          paymentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
          deliveryPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
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
      const mockService = {
        id: '1',
        agent_id: 'different-user',
        name: 'Test Service',
        type: 'CUSTOM',
        price: 100,
        description: 'Test description',
        example: 'Test example',
        privacy_settings: {
          contentPrivacy: SERVICE_PRIVACY_LEVELS.MIXED,
          paymentPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
          deliveryPrivacy: SERVICE_PRIVACY_LEVELS.MIXED,
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
          created_at: new Date().toISOString(),
          read: false
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
            paymentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC
          }
        };
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(publicService);
        jest.spyOn(mockSupabaseService, 'sendMessage').mockResolvedValue({
          id: '1',
          sender_agent_id: mockUserId,
          recipient_agent_id: publicService.agent_id,
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
          created_at: new Date().toISOString(),
          read: false
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
        })).rejects.toThrow(new McpError(ErrorCode.InvalidParams, 'No authenticated agent found'));
      });
    });

    describe('serviceDelivery', () => {
      const mockService = {
        id: '1',
        agent_id: 'different-user',
        name: 'Test Service',
        type: 'CUSTOM',
        price: 100,
        description: 'Test description',
        example: 'Test example',
        privacy_settings: {
          contentPrivacy: SERVICE_PRIVACY_LEVELS.MIXED,
          paymentPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
          deliveryPrivacy: SERVICE_PRIVACY_LEVELS.MIXED,
          conditions: {
            text: 'Service terms and conditions...',
            privacy: SERVICE_PRIVACY_LEVELS.PRIVATE
          }
        }
      };

      const mockServiceContent: ServiceContent = {
        service_id: '1',
        agent_id: 'different-user',
        content: { test: 'data' },
        version: '1.0.0',
        tags: ['test'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      beforeEach(() => {
        // Mock ServiceContentStorage
        const mockServiceContentStorage = {
          getContent: jest.fn().mockImplementation(async (...args: unknown[]) => mockServiceContent),
          storeContent: jest.fn().mockImplementation(async (content: any) => ({
            ...content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          listVersions: jest.fn().mockImplementation(async (...args: unknown[]) => ['1.0.0']),
          deleteContent: jest.fn().mockImplementation(async (...args: unknown[]) => undefined)
        };

        jest.spyOn(ServiceContentStorage, 'getInstance').mockReturnValue(mockServiceContentStorage as unknown as ServiceContentStorage);
      });

      it('should handle mixed privacy delivery correctly', async () => {
        const mockUserId = 'user123';
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(mockService);
        jest.spyOn(mockSupabaseService, 'sendMessage').mockResolvedValue({
          id: '1',
          sender_agent_id: mockService.agent_id,
          recipient_agent_id: mockUserId,
          public: {
            topic: MESSAGE_TOPICS.DELIVERY,
            serviceId: mockService.id,
            content: {
              type: CONTENT_TYPES.TRANSACTION,
              data: {
                type: TRANSACTION_TYPES.SERVICE_DELIVERY,
                status: MESSAGE_STATUS.COMPLETED,
                service_name: mockService.name,
                version: mockServiceContent.version,
                timestamp: new Date().toISOString()
              },
              metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                extra: {
                  purpose: MESSAGE_PURPOSE.SERVICE_DELIVERY
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
          created_at: new Date().toISOString(),
          read: false
        });

        const result = await toolHandler.handleToolCall('serviceDelivery', {
          serviceId: '1',
          data: {},
          privacyPreferences: {
            contentPrivacy: SERVICE_PRIVACY_LEVELS.MIXED,
            paymentPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
            deliveryPrivacy: SERVICE_PRIVACY_LEVELS.MIXED
          }
        });

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse(result.content[0].text);
        expect(response.status).toBe('success');
        expect(response.privacy).toBe(SERVICE_PRIVACY_LEVELS.MIXED);
      });

      it('should handle private delivery correctly', async () => {
        const mockUserId = 'user123';
        const privateService = {
          ...mockService,
          privacy_settings: {
            ...mockService.privacy_settings,
            deliveryPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE
          }
        };
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(privateService);
        jest.spyOn(mockSupabaseService, 'sendMessage').mockImplementation(async (message) => ({
          ...message,
          id: '1',
          created_at: new Date().toISOString(),
          read: false
        }));

        const result = await toolHandler.handleToolCall('serviceDelivery', {
          serviceId: '1',
          data: {},
          privacyPreferences: {
            contentPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
            paymentPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE,
            deliveryPrivacy: SERVICE_PRIVACY_LEVELS.PRIVATE
          }
        });

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse(result.content[0].text);
        expect(response.status).toBe('success');
        expect(response.privacy).toBe(SERVICE_PRIVACY_LEVELS.PRIVATE);
      });

      it('should handle public delivery correctly', async () => {
        const mockUserId = 'user123';
        const publicService = {
          ...mockService,
          privacy_settings: {
            ...mockService.privacy_settings,
            deliveryPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC
          }
        };
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(mockUserId);
        jest.spyOn(mockSupabaseService, 'getServiceById').mockResolvedValue(publicService);
        jest.spyOn(mockSupabaseService, 'sendMessage').mockImplementation(async (message) => ({
          ...message,
          id: '1',
          created_at: new Date().toISOString(),
          read: false
        }));

        const result = await toolHandler.handleToolCall('serviceDelivery', {
          serviceId: '1',
          data: {},
          privacyPreferences: {
            contentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
            paymentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
            deliveryPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC
          }
        });

        expect(result.content[0].type).toBe('text');
        const response = JSON.parse(result.content[0].text);
        expect(response.status).toBe('success');
        expect(response.privacy).toBe(SERVICE_PRIVACY_LEVELS.PUBLIC);
      });

      it('should throw error when user is not authenticated', async () => {
        jest.spyOn(mockAuthService, 'getCurrentUserId').mockReturnValue(null);

        await expect(toolHandler.handleToolCall('serviceDelivery', {
          serviceId: '1',
          data: {},
          privacyPreferences: {
            contentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
            paymentPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC,
            deliveryPrivacy: SERVICE_PRIVACY_LEVELS.PUBLIC
          }
        })).rejects.toThrow(new McpError(ErrorCode.InvalidParams, 'No authenticated agent found'));
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