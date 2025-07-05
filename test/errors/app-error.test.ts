import { AppError, formatError } from '../../src/errors/AppError.js';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create an AppError with default values', () => {
      const error = new AppError('Test error');
      
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
      expect(error.code).toBe('APP_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.cause).toBeUndefined();
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

    it('should create an AppError with custom values', () => {
      const error = new AppError('Custom error', 'CUSTOM_CODE', 400);
      
      expect(error.message).toBe('Custom error');
      expect(error.name).toBe('AppError');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.cause).toBeUndefined();
    });

    it('should handle Error cause', () => {
      const originalError = new Error('Original error');
      const error = new AppError('Wrapped error', 'WRAP_ERROR', 500, originalError);
      
      expect(error.message).toBe('Wrapped error');
      expect(error.code).toBe('WRAP_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.cause).toBe(originalError);
    });

    it('should handle string cause', () => {
      const error = new AppError('Wrapped error', 'WRAP_ERROR', 500, 'String cause');
      
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause?.message).toBe('String cause');
    });

    it('should handle undefined cause', () => {
      const error = new AppError('Test error', 'TEST_CODE', 500, undefined);
      
      expect(error.cause).toBeUndefined();
    });

    it('should handle non-Error, non-string cause', () => {
      const error = new AppError('Test error', 'TEST_CODE', 500, { some: 'object' });
      
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause?.message).toBe('Unknown error');
    });
  });

  describe('formatError', () => {
    it('should format a simple AppError', () => {
      const error = new AppError('Test error', 'TEST_CODE', 400);
      const formatted = formatError(error);
      
      expect(formatted).toEqual({
        name: 'AppError',
        message: 'Test error',
        code: 'TEST_CODE',
        statusCode: 400,
        stack: error.stack
      });
    });

    it('should format AppError with Error cause', () => {
      const originalError = new Error('Original error');
      const error = new AppError('Wrapped error', 'WRAP_ERROR', 500, originalError);
      const formatted = formatError(error);
      
      expect(formatted.name).toBe('AppError');
      expect(formatted.message).toBe('Wrapped error');
      expect(formatted.code).toBe('WRAP_ERROR');
      expect(formatted.statusCode).toBe(500);
      expect(formatted.stack).toBe(error.stack);
      expect(formatted.cause).toEqual({
        name: 'Error',
        message: 'Original error',
        code: 'UNKNOWN',
        statusCode: 500,
        stack: originalError.stack
      });
    });

    it('should format AppError with nested AppError cause', () => {
      const innerError = new AppError('Inner error', 'INNER_CODE', 400);
      const outerError = new AppError('Outer error', 'OUTER_CODE', 500, innerError);
      const formatted = formatError(outerError);
      
      expect(formatted.name).toBe('AppError');
      expect(formatted.message).toBe('Outer error');
      expect(formatted.code).toBe('OUTER_CODE');
      expect(formatted.statusCode).toBe(500);
      expect(formatted.cause).toEqual({
        name: 'AppError',
        message: 'Inner error',
        code: 'INNER_CODE',
        statusCode: 400,
        stack: innerError.stack
      });
    });

    it('should format AppError with string cause', () => {
      const error = new AppError('Wrapped error', 'WRAP_ERROR', 500, 'String cause');
      const formatted = formatError(error);
      
      expect(formatted.cause).toEqual({
        name: 'Error',
        message: 'String cause',
        code: 'UNKNOWN',
        statusCode: 500,
        stack: error.cause?.stack
      });
    });

    it('should format AppError without cause', () => {
      const error = new AppError('Simple error', 'SIMPLE_CODE', 200);
      const formatted = formatError(error);
      
      expect(formatted).toEqual({
        name: 'AppError',
        message: 'Simple error',
        code: 'SIMPLE_CODE',
        statusCode: 200,
        stack: error.stack
      });
      expect(formatted.cause).toBeUndefined();
    });

    it('should handle deeply nested error chains', () => {
      const level3Error = new AppError('Level 3', 'L3_CODE', 300);
      const level2Error = new AppError('Level 2', 'L2_CODE', 400, level3Error);
      const level1Error = new AppError('Level 1', 'L1_CODE', 500, level2Error);
      const formatted = formatError(level1Error);
      
      expect(formatted.name).toBe('AppError');
      expect(formatted.message).toBe('Level 1');
      expect(formatted.code).toBe('L1_CODE');
      expect(formatted.statusCode).toBe(500);
      
      expect(formatted.cause?.name).toBe('AppError');
      expect(formatted.cause?.message).toBe('Level 2');
      expect(formatted.cause?.code).toBe('L2_CODE');
      expect(formatted.cause?.statusCode).toBe(400);
      
      expect(formatted.cause?.cause?.name).toBe('AppError');
      expect(formatted.cause?.cause?.message).toBe('Level 3');
      expect(formatted.cause?.cause?.code).toBe('L3_CODE');
      expect(formatted.cause?.cause?.statusCode).toBe(300);
    });
  });

  describe('error inheritance', () => {
    it('should properly inherit from Error', () => {
      const error = new AppError('Test error');
      
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
    });

    it('should have correct prototype chain', () => {
      const error = new AppError('Test error');
      
      expect(error.constructor).toBe(AppError);
      expect(error.constructor.name).toBe('AppError');
    });
  });
}); 