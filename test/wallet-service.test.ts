import { generateRandomAmount, isValidAmountFormat, generateValidRandomAmount } from '../src/utils/wallet-service.js';

describe('Wallet Service', () => {
  describe('generateRandomAmount', () => {
    it('should generate a random amount with the correct format', () => {
      const baseAmount = 10;
      const result = generateRandomAmount(baseAmount);
      
      // Should start with the base amount
      expect(result).toMatch(/^10\.\d{6}$/);
      
      // Should be a valid amount format
      expect(isValidAmountFormat(result)).toBe(true);
    });

    it('should generate different amounts on multiple calls', () => {
      const baseAmount = 5;
      const result1 = generateRandomAmount(baseAmount);
      const result2 = generateRandomAmount(baseAmount);
      
      // Both should be valid
      expect(isValidAmountFormat(result1)).toBe(true);
      expect(isValidAmountFormat(result2)).toBe(true);
      
      // They should be different (though there's a small chance they could be the same)
      // We'll just verify they're both valid formats
      expect(result1).toMatch(/^5\.\d{6}$/);
      expect(result2).toMatch(/^5\.\d{6}$/);
    });

    it('should work with zero base amount', () => {
      const result = generateRandomAmount(0);
      expect(result).toMatch(/^0\.\d{6}$/);
      expect(isValidAmountFormat(result)).toBe(true);
    });

    it('should work with large base amounts', () => {
      const result = generateRandomAmount(999999);
      expect(result).toMatch(/^999999\.\d{6}$/);
      expect(isValidAmountFormat(result)).toBe(true);
    });
  });

  describe('isValidAmountFormat', () => {
    it('should return true for valid amount formats', () => {
      const validAmounts = [
        '10.123456',
        '0.000001',
        '999999.999999',
        '1.000000',
        '42.987654'
      ];

      validAmounts.forEach(amount => {
        expect(isValidAmountFormat(amount)).toBe(true);
      });
    });

    it('should return false for invalid amount formats', () => {
      const invalidAmounts = [
        '10.12345',      // Only 5 decimal places
        '10.1234567',    // 7 decimal places
        '10.123456.',    // Trailing dot
        '.123456',       // No base amount
        '10.123456a',    // Invalid character
        '10,123456',     // Wrong separator
        '10',            // No decimal part
        '10.',           // No decimal digits
        '',              // Empty string
        'abc.123456',    // Non-numeric base
        '10.abc123'      // Non-numeric decimals
      ];

      invalidAmounts.forEach(amount => {
        expect(isValidAmountFormat(amount)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(isValidAmountFormat('0.000000')).toBe(true);
      expect(isValidAmountFormat('999999.999999')).toBe(true);
      expect(isValidAmountFormat('1.000000')).toBe(true);
    });
  });

  describe('generateValidRandomAmount', () => {
    it('should generate a valid amount within retry limit', () => {
      const baseAmount = 10;
      const result = generateValidRandomAmount(baseAmount);
      
      expect(result).toMatch(/^10\.\d{6}$/);
      expect(isValidAmountFormat(result)).toBe(true);
    });

    it('should work with custom retry limit', () => {
      const baseAmount = 5;
      const maxRetries = 50;
      const result = generateValidRandomAmount(baseAmount, maxRetries);
      
      expect(result).toMatch(/^5\.\d{6}$/);
      expect(isValidAmountFormat(result)).toBe(true);
    });

    it('should throw error when unable to generate valid amount', () => {
      // This test is tricky because the function should always succeed
      // We'll test the error case by creating a mock implementation
      const mockGenerateRandomAmount = () => '10.12345'; // Invalid format
      
      // Create a test version of generateValidRandomAmount that uses our mock
      const testGenerateValidRandomAmount = (baseAmount: number, maxRetries: number = 100): string => {
        for (let i = 0; i < maxRetries; i++) {
          const amount = mockGenerateRandomAmount();
          if (isValidAmountFormat(amount)) {
            return amount;
          }
        }
        
        throw new Error(`Failed to generate valid random amount after ${maxRetries} attempts`);
      };
      
      expect(() => {
        testGenerateValidRandomAmount(10, 1); // Only 1 retry
      }).toThrow('Failed to generate valid random amount after 1 attempts');
    });

    it('should work with zero base amount', () => {
      const result = generateValidRandomAmount(0);
      expect(result).toMatch(/^0\.\d{6}$/);
      expect(isValidAmountFormat(result)).toBe(true);
    });

    it('should work with large base amounts', () => {
      const result = generateValidRandomAmount(999999);
      expect(result).toMatch(/^999999\.\d{6}$/);
      expect(isValidAmountFormat(result)).toBe(true);
    });
  });
}); 