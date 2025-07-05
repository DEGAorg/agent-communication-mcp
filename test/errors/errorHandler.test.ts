import { jest } from '@jest/globals';
import { handleError, formatErrorForResponse, withErrorHandling } from '../../src/errors/errorHandler.js';
import { AppError } from '../../src/errors/AppError.js';
import { mockLogger } from '../test-helpers.js';

// Mock the logger
jest.mock('../../src/logger.js', () => ({
  logger: mockLogger
}));

describe('errorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleError', () => {
    it('should log and rethrow AppError without modification', () => {
      const appError = new AppError('Test AppError', 'TEST_CODE', 400);
      const context = 'test operation';

      expect(() => handleError(context, appError)).toThrow(appError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error test operation',
        error: 'Test AppError',
        details: appError.stack,
        context: {
          operation: 'test operation',
          timestamp: expect.any(String)
        }
      });
    });

    it('should convert Error to AppError and throw', () => {
      const originalError = new Error('Original error message');
      const context = 'error conversion test';

      expect(() => handleError(context, originalError)).toThrow(AppError);

      let thrownError: AppError;
      try {
        handleError(context, originalError);
        throw new Error('Expected handleError to throw');
      } catch (error) {
        thrownError = error as AppError;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('Original error message');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);
      expect(thrownError.cause).toBe(originalError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error error conversion test',
        error: 'Original error message',
        details: originalError.stack,
        context: {
          operation: 'error conversion test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should convert string to AppError and throw', () => {
      const stringError = 'String error message';
      const context = 'string error test';

      expect(() => handleError(context, stringError)).toThrow(AppError);

      let thrownError: AppError;
      try {
        handleError(context, stringError);
        throw new Error('Expected handleError to throw');
      } catch (error) {
        thrownError = error as AppError;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('String error message');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);
      expect(thrownError.cause).toBeInstanceOf(Error);
      expect(thrownError.cause?.message).toBe('String error message');

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error string error test',
        error: 'String error message',
        details: 'String error message',
        context: {
          operation: 'string error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should convert unknown types to AppError and throw', () => {
      const unknownError = { custom: 'error object' };
      const context = 'unknown error test';

      expect(() => handleError(context, unknownError)).toThrow(AppError);

      let thrownError: AppError;
      try {
        handleError(context, unknownError);
        throw new Error('Expected handleError to throw');
      } catch (error) {
        thrownError = error as AppError;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('[object Object]');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error unknown error test',
        error: '[object Object]',
        details: '[object Object]',
        context: {
          operation: 'unknown error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle null error', () => {
      const context = 'null error test';

      expect(() => handleError(context, null)).toThrow(AppError);

      let thrownError: AppError;
      try {
        handleError(context, null);
        throw new Error('Expected handleError to throw');
      } catch (error) {
        thrownError = error as AppError;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('null');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error null error test',
        error: 'null',
        details: 'null',
        context: {
          operation: 'null error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle undefined error', () => {
      const context = 'undefined error test';

      expect(() => handleError(context, undefined)).toThrow(AppError);

      let thrownError: AppError;
      try {
        handleError(context, undefined);
        throw new Error('Expected handleError to throw');
      } catch (error) {
        thrownError = error as AppError;
      }

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('undefined');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error undefined error test',
        error: 'undefined',
        details: 'undefined',
        context: {
          operation: 'undefined error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should include timestamp in log context', () => {
      const error = new Error('Test error');
      const context = 'timestamp test';

      const beforeCall = new Date();
      
      try {
        handleError(context, error);
      } catch {
        // Expected to throw
      }

      const afterCall = new Date();

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error timestamp test',
        error: 'Test error',
        details: error.stack,
        context: {
          operation: 'timestamp test',
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        }
      });

      const loggedTimestamp = mockLogger.error.mock.calls[0][0].context.timestamp;
      const timestamp = new Date(loggedTimestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });

  describe('formatErrorForResponse', () => {
    it('should format AppError for response', () => {
      const appError = new AppError('Test error', 'TEST_CODE', 400);
      const formatted = formatErrorForResponse(appError);

      expect(formatted).toEqual({
        message: 'Test error',
        statusCode: 400
      });
    });

    it('should format AppError with different status codes', () => {
      const appError = new AppError('Not found', 'NOT_FOUND', 404);
      const formatted = formatErrorForResponse(appError);

      expect(formatted).toEqual({
        message: 'Not found',
        statusCode: 404
      });
    });

    it('should return generic message for unknown errors', () => {
      const unknownError = new Error('Internal error');
      const formatted = formatErrorForResponse(unknownError);

      expect(formatted).toEqual({
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    });

    it('should return generic message for string errors', () => {
      const stringError = 'String error';
      const formatted = formatErrorForResponse(stringError);

      expect(formatted).toEqual({
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    });

    it('should return generic message for null errors', () => {
      const formatted = formatErrorForResponse(null);

      expect(formatted).toEqual({
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    });

    it('should return generic message for undefined errors', () => {
      const formatted = formatErrorForResponse(undefined);

      expect(formatted).toEqual({
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    });

    it('should return generic message for object errors', () => {
      const objectError = { custom: 'error' };
      const formatted = formatErrorForResponse(objectError);

      expect(formatted).toEqual({
        message: 'An unexpected error occurred',
        statusCode: 500
      });
    });
  });

  describe('withErrorHandling', () => {
    it('should return successful result when function succeeds', async () => {
      const successFn = jest.fn().mockResolvedValue('success result');
      const context = 'success test';

      const result = await withErrorHandling(successFn, context);

      expect(result).toBe('success result');
      expect(successFn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle and rethrow AppError', async () => {
      const appError = new AppError('Test AppError', 'TEST_CODE', 400);
      const failingFn = jest.fn().mockRejectedValue(appError);
      const context = 'app error test';

      await expect(withErrorHandling(failingFn, context)).rejects.toThrow(appError);

      expect(failingFn).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error app error test',
        error: 'Test AppError',
        details: appError.stack,
        context: {
          operation: 'app error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should convert and rethrow unknown errors', async () => {
      const unknownError = new Error('Unknown error');
      const failingFn = jest.fn().mockRejectedValue(unknownError);
      const context = 'unknown error test';

      await expect(withErrorHandling(failingFn, context)).rejects.toThrow(AppError);

      const thrownError = await withErrorHandling(failingFn, context).catch(error => error) as AppError;

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('Unknown error');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);
      expect(thrownError.cause).toBe(unknownError);

      expect(failingFn).toHaveBeenCalledTimes(2); // Called twice due to the test structure
      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error unknown error test',
        error: 'Unknown error',
        details: unknownError.stack,
        context: {
          operation: 'unknown error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle string errors', async () => {
      const stringError = 'String error';
      const failingFn = jest.fn().mockRejectedValue(stringError);
      const context = 'string error test';

      await expect(withErrorHandling(failingFn, context)).rejects.toThrow(AppError);

      const thrownError = await withErrorHandling(failingFn, context).catch(error => error) as AppError;

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('String error');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error string error test',
        error: 'String error',
        details: 'String error',
        context: {
          operation: 'string error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle null errors', async () => {
      const failingFn = jest.fn().mockRejectedValue(null);
      const context = 'null error test';

      await expect(withErrorHandling(failingFn, context)).rejects.toThrow(AppError);

      const thrownError = await withErrorHandling(failingFn, context).catch(error => error) as AppError;

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('null');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error null error test',
        error: 'null',
        details: 'null',
        context: {
          operation: 'null error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle undefined errors', async () => {
      const failingFn = jest.fn().mockRejectedValue(undefined);
      const context = 'undefined error test';

      await expect(withErrorHandling(failingFn, context)).rejects.toThrow(AppError);

      const thrownError = await withErrorHandling(failingFn, context).catch(error => error) as AppError;

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('undefined');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error undefined error test',
        error: 'undefined',
        details: 'undefined',
        context: {
          operation: 'undefined error test',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle object errors', async () => {
      const objectError = { custom: 'error object' };
      const failingFn = jest.fn().mockRejectedValue(objectError);
      const context = 'object error test';

      await expect(withErrorHandling(failingFn, context)).rejects.toThrow(AppError);

      const thrownError = await withErrorHandling(failingFn, context).catch(error => error) as AppError;

      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toBe('[object Object]');
      expect(thrownError.code).toBe('INTERNAL_ERROR');
      expect(thrownError.statusCode).toBe(500);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error object error test',
        error: '[object Object]',
        details: '[object Object]',
        context: {
          operation: 'object error test',
          timestamp: expect.any(String)
        }
      });
    });
  });
}); 