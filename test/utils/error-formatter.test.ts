import { describe, it, expect } from '@jest/globals';
import { formatError } from '../../src/utils/error-formatter.js';

describe('formatError', () => {
  describe('Error instances', () => {
    it('should format Error instances correctly', () => {
      const error = new Error('Test error message');
      const result = formatError(error);
      
      expect(result).toBe('Error: Test error message');
    });

    it('should format custom Error types correctly', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      
      const error = new CustomError('Custom error message');
      const result = formatError(error);
      
      expect(result).toBe('CustomError: Custom error message');
    });

    it('should handle Error with empty message', () => {
      const error = new Error('');
      const result = formatError(error);
      
      expect(result).toBe('Error: ');
    });
  });

  describe('Non-Error values', () => {
    it('should format string values', () => {
      const result = formatError('String error message');
      expect(result).toBe('String error message');
    });

    it('should format number values', () => {
      const result = formatError(123);
      expect(result).toBe('123');
    });

    it('should format boolean values', () => {
      const result = formatError(true);
      expect(result).toBe('true');
    });

    it('should format null values', () => {
      const result = formatError(null);
      expect(result).toBe('null');
    });

    it('should format undefined values', () => {
      const result = formatError(undefined);
      expect(result).toBe('undefined');
    });

    it('should format object values', () => {
      const obj = { key: 'value', number: 42 };
      const result = formatError(obj);
      expect(result).toBe('[object Object]');
    });

    it('should format array values', () => {
      const arr = [1, 2, 3, 'test'];
      const result = formatError(arr);
      expect(result).toBe('1,2,3,test');
    });

    it('should format function values', () => {
      const func = () => 'test';
      const result = formatError(func);
      expect(result).toBe('() => \'test\'');
    });
  });

  describe('Edge cases', () => {
    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      
      const result = formatError(obj);
      expect(result).toBe('[object Object]');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const result = formatError(longString);
      expect(result).toBe(longString);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const result = formatError(specialChars);
      expect(result).toBe(specialChars);
    });
  });
}); 