import { describe, it, expect } from '@jest/globals';
import { isAuthRequired, getAuthRequiredTools } from '../../src/utils/auth-guard.js';

describe('auth-guard', () => {
  describe('isAuthRequired', () => {
    it('should return true for protected tools', () => {
      const protectedTools = [
        'listServices',
        'registerService',
        'storeServiceContent',
        'servicePayment',
        'queryServiceDelivery',
        'provideServiceFeedback',
        'disableService'
      ];

      protectedTools.forEach(toolName => {
        expect(isAuthRequired(toolName)).toBe(true);
      });
    });

    it('should return false for non-protected tools', () => {
      const nonProtectedTools = [
        'status',
        'login',
        'unknownTool',
        'testTool',
        'someOtherTool'
      ];

      nonProtectedTools.forEach(toolName => {
        expect(isAuthRequired(toolName)).toBe(false);
      });
    });

    it('should handle case sensitivity', () => {
      expect(isAuthRequired('listservices')).toBe(false);
      expect(isAuthRequired('ListServices')).toBe(false);
      expect(isAuthRequired('LIST_SERVICES')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isAuthRequired('')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(isAuthRequired(' listServices ')).toBe(false);
      expect(isAuthRequired('listServices ')).toBe(false);
      expect(isAuthRequired(' listServices')).toBe(false);
    });
  });

  describe('getAuthRequiredTools', () => {
    it('should return the correct list of protected tools', () => {
      const expectedTools = [
        'listServices',
        'registerService',
        'storeServiceContent',
        'servicePayment',
        'queryServiceDelivery',
        'provideServiceFeedback',
        'disableService'
      ];

      const result = getAuthRequiredTools();

      expect(result).toEqual(expectedTools);
      expect(result).toHaveLength(7);
    });

    it('should return a new array each time', () => {
      const result1 = getAuthRequiredTools();
      const result2 = getAuthRequiredTools();

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2); // Different array references
    });

    it('should maintain the correct order', () => {
      const result = getAuthRequiredTools();

      expect(result[0]).toBe('listServices');
      expect(result[1]).toBe('registerService');
      expect(result[2]).toBe('storeServiceContent');
      expect(result[3]).toBe('servicePayment');
      expect(result[4]).toBe('queryServiceDelivery');
      expect(result[5]).toBe('provideServiceFeedback');
    });
  });

  describe('consistency between functions', () => {
    it('should have consistent data between isAuthRequired and getAuthRequiredTools', () => {
      const authRequiredTools = getAuthRequiredTools();

      // All tools returned by getAuthRequiredTools should require auth
      authRequiredTools.forEach(toolName => {
        expect(isAuthRequired(toolName)).toBe(true);
      });
    });

    it('should not have any tools that require auth but are not in the list', () => {
      const authRequiredTools = getAuthRequiredTools();

      // Test some random tool names to ensure they don't require auth
      const randomTools = [
        'status',
        'login',
        'disableService',
        'unknownTool',
        'testTool',
        'someOtherTool',
        'randomTool',
        'anotherTool'
      ];

      randomTools.forEach(toolName => {
        if (isAuthRequired(toolName)) {
          expect(authRequiredTools).toContain(toolName);
        }
      });
    });
  });
}); 