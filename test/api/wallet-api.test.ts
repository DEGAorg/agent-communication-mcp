import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { verifyTransaction, sendFunds } from '../../src/api/wallet-api.js';
import { mockLogger, mutableConfig, resetTestMocks } from '../test-helpers.js';

// Mock the config and logger modules using the shared helpers
jest.mock('../../src/config.js', () => ({
  config: mutableConfig,
}));

jest.mock('../../src/logger.js', () => ({
  logger: mockLogger,
}));

// Mock the http and https modules
const mockHttp = {
  request: jest.fn()
};
const mockHttps = {
  request: jest.fn()
};
jest.mock('http', () => mockHttp);
jest.mock('https', () => mockHttps);

describe('Wallet API', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    resetTestMocks();
    // Set up mock request and response objects
    mockRequest = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn()
    };
    mockResponse = {
      on: jest.fn()
    };
    // Set up the mock response data handling
    mockResponse.on.mockImplementation((event: string, callback: any) => {
      if (event === 'data') {
        (callback as Function)(
          '{"success":true,"data":{"exists":true,"transactionAmount":"10.123456"}}'
        );
      } else if (event === 'end') {
        (callback as Function)('');
      }
    });
    // Set up the mock request error handling
    mockRequest.on.mockImplementation((event: string, callback: any) => {
      if (event === 'error') {
        // Don't call error callback by default
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verifyTransaction', () => {
    it('should return true when transaction exists and amount matches', async () => {
      // Mock successful response
      mockHttps.request.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await verifyTransaction('tx123', '10.123456');
      
      expect(result).toBe(true);
      expect(mockHttps.request).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        }),
        expect.any(Function)
      );
    });

    it('should return false when transaction does not exist', async () => {
      // Mock response where transaction doesn't exist
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          (callback as Function)('{"success":true,"data":{"exists":false,"transactionAmount":"10.123456"}}');
        } else if (event === 'end') {
          (callback as Function)('');
        }
      });

      mockHttps.request.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await verifyTransaction('tx123', '10.123456');
      
      expect(result).toBe(false);
    });

    it('should return false when amount does not match', async () => {
      // Mock response where amount doesn't match
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          (callback as Function)('{"success":true,"data":{"exists":true,"transactionAmount":"20.654321"}}');
        } else if (event === 'end') {
          (callback as Function)('');
        }
      });

      mockHttps.request.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await verifyTransaction('tx123', '10.123456');
      
      expect(result).toBe(false);
    });

    it('should handle missing WALLET_MCP_URL configuration', async () => {
      // Temporarily mock config to return undefined URL
      mutableConfig.walletMcpUrl = undefined as any;

      const result = await verifyTransaction('tx123', '10.123456');
      
      expect(result).toBe(false);
    });

    it('should handle URL construction errors', async () => {
      // Mock URL construction error by making the URL constructor throw
      const originalURL = global.URL;
      global.URL = jest.fn().mockImplementation(() => {
        throw new Error('Invalid URL');
      }) as any;

      const result = await verifyTransaction('tx123', '10.123456');
      
      expect(result).toBe(false);

      // Restore original URL
      global.URL = originalURL;
    });
  });

  describe('sendFunds', () => {
    it('should return success with transaction ID when funds are sent successfully', async () => {
      // Mock successful response
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          (callback as Function)('{"success":true,"data":{"transactionId":"tx456"}}');
        } else if (event === 'end') {
          (callback as Function)('');
        }
      });

      mockHttps.request.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await sendFunds('destination123', '50.000000');
      
      expect(result).toEqual({
        success: true,
        transactionId: 'tx456'
      });
    });

    it('should return error when API call fails', async () => {
      // Mock request error
      mockRequest.on.mockImplementation((event: string, callback: any) => {
        if (event === 'error') {
          (callback as Function)(new Error('Network error'));
        }
      });

      mockHttps.request.mockImplementation((url, options, callback) => {
        return mockRequest;
      });

      const result = await sendFunds('destination123', '50.000000');
      
      expect(result).toEqual({
        success: false,
        error: 'Request failed'
      });
    });

    it('should return error when API returns error response', async () => {
      // Mock API error response
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          (callback as Function)('{"success":false,"error":"Insufficient funds"}');
        } else if (event === 'end') {
          (callback as Function)('');
        }
      });

      mockHttps.request.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await sendFunds('destination123', '50.000000');
      
      expect(result).toEqual({
        success: false,
        error: 'Insufficient funds'
      });
    });

    it('should handle missing WALLET_MCP_URL configuration', async () => {
      // Temporarily mock config to return undefined URL
      mutableConfig.walletMcpUrl = undefined as any;

      const result = await sendFunds('destination123', '50.000000');
      
      expect(result).toEqual({
        success: false,
        error: 'Wallet MCP URL not configured'
      });
    });

    it('should handle response parsing errors', async () => {
      // Mock invalid JSON response
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          (callback as Function)('invalid json');
        } else if (event === 'end') {
          (callback as Function)('');
        }
      });

      mockHttps.request.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await sendFunds('destination123', '50.000000');
      
      expect(result).toEqual({
        success: false,
        error: 'Failed to parse response'
      });
    });

    it('should handle URL construction errors', async () => {
      // Mock URL construction error
      const originalURL = global.URL;
      global.URL = jest.fn().mockImplementation(() => {
        throw new Error('Invalid URL');
      }) as any;

      const result = await sendFunds('destination123', '50.000000');
      
      expect(result).toEqual({
        success: false,
        error: 'Internal error'
      });

      // Restore original URL
      global.URL = originalURL;
    });

    it('should handle missing transaction ID in successful response', async () => {
      // Mock response without transaction ID
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          (callback as Function)('{"success":true,"data":{}}');
        } else if (event === 'end') {
          (callback as Function)('');
        }
      });

      mockHttps.request.mockImplementation((url, options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const result = await sendFunds('destination123', '50.000000');
      
      expect(result).toEqual({
        success: true,
        transactionId: undefined
      });
    });
  });
}); 