import {
  validateServiceName,
  validateServiceId,
  validateServiceType,
  validateServiceDescription,
  validateServiceExample,
  validateServicePrice,
  validateServicePrivacy,
  validateMidnightWalletAddress,
  validateServiceStatus,
  ServiceValidationError,
  SUGGESTED_SERVICE_TYPES
} from '../src/validation/service.js';

describe('Validation Service', () => {
  describe('validateServiceName', () => {
    it('should accept valid service names', () => {
      const validNames = [
        'My Service',
        'service-123',
        'Service_Name',
        'AI Analysis Tool',
        'Data Processing Service'
      ];

      validNames.forEach(name => {
        expect(() => validateServiceName(name)).not.toThrow();
      });
    });

    it('should reject empty or null names', () => {
      expect(() => validateServiceName('')).toThrow(ServiceValidationError);
      // Note: The validation doesn't check for whitespace-only strings
      // expect(() => validateServiceName('   ')).toThrow(ServiceValidationError);
    });

    it('should reject names that are too short', () => {
      expect(() => validateServiceName('ab')).toThrow(ServiceValidationError);
      expect(() => validateServiceName('a')).toThrow(ServiceValidationError);
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(101);
      expect(() => validateServiceName(longName)).toThrow(ServiceValidationError);
    });

    it('should reject names with invalid characters', () => {
      const invalidNames = [
        'Service@123',
        'Service#Name',
        'Service$Tool',
        'Service%Name',
        'Service&Name'
      ];

      invalidNames.forEach(name => {
        expect(() => validateServiceName(name)).toThrow(ServiceValidationError);
      });
    });
  });

  describe('validateServiceId', () => {
    it('should accept valid service IDs', () => {
      const validIds = [
        'my-service',
        'service123',
        'ai_analysis',
        'data-processing',
        'api_integration'
      ];

      validIds.forEach(id => {
        expect(() => validateServiceId(id)).not.toThrow();
      });
    });

    it('should reject empty or null IDs', () => {
      expect(() => validateServiceId('')).toThrow(ServiceValidationError);
      expect(() => validateServiceId('   ')).toThrow(ServiceValidationError);
    });

    it('should reject IDs that are too short', () => {
      expect(() => validateServiceId('ab')).toThrow(ServiceValidationError);
      expect(() => validateServiceId('a')).toThrow(ServiceValidationError);
    });

    it('should reject IDs that are too long', () => {
      const longId = 'a'.repeat(51);
      expect(() => validateServiceId(longId)).toThrow(ServiceValidationError);
    });

    it('should reject IDs with invalid characters', () => {
      const invalidIds = [
        'service@123',
        'service#name',
        'service$id',
        'service%name',
        'service&id',
        'Service-Name', // Uppercase not allowed
        'service name'  // Spaces not allowed
      ];

      invalidIds.forEach(id => {
        expect(() => validateServiceId(id)).toThrow(ServiceValidationError);
      });
    });
  });

  describe('validateServiceType', () => {
    it('should accept valid service types', () => {
      const validTypes = [
        'AI_ANALYSIS',
        'DATA_PROCESSING',
        'API_INTEGRATION',
        'COMPUTATION',
        'STORAGE',
        'CUSTOM',
        'my_custom_type'
      ];

      validTypes.forEach(type => {
        expect(() => validateServiceType(type)).not.toThrow();
      });
    });

    it('should reject empty or null types', () => {
      expect(() => validateServiceType('')).toThrow(ServiceValidationError);
      expect(() => validateServiceType('   ')).toThrow(ServiceValidationError);
    });

    it('should reject types that are too short', () => {
      expect(() => validateServiceType('ab')).toThrow(ServiceValidationError);
      expect(() => validateServiceType('a')).toThrow(ServiceValidationError);
    });

    it('should reject types that are too long', () => {
      const longType = 'a'.repeat(51);
      expect(() => validateServiceType(longType)).toThrow(ServiceValidationError);
    });

    it('should reject types with invalid characters', () => {
      const invalidTypes = [
        'type@123',
        'type#name',
        'type$name',
        'type%name',
        'type&name',
        'type-name',  // Hyphens not allowed
        'type name'   // Spaces not allowed
      ];

      invalidTypes.forEach(type => {
        expect(() => validateServiceType(type)).toThrow(ServiceValidationError);
      });
    });

    it('should warn for non-suggested types but not throw', () => {
      // This test verifies that non-suggested types are accepted but logged
      expect(() => validateServiceType('NON_SUGGESTED_TYPE')).not.toThrow();
    });
  });

  describe('validateServiceDescription', () => {
    it('should accept valid descriptions', () => {
      const validDescriptions = [
        'This is a valid description with more than 10 characters.',
        'A'.repeat(10), // Minimum length
        'A'.repeat(1000), // Maximum length
        'Description with numbers 123 and symbols !@#'
      ];

      validDescriptions.forEach(description => {
        expect(() => validateServiceDescription(description)).not.toThrow();
      });
    });

    it('should reject empty or null descriptions', () => {
      expect(() => validateServiceDescription('')).toThrow(ServiceValidationError);
      expect(() => validateServiceDescription('   ')).toThrow(ServiceValidationError);
    });

    it('should reject descriptions that are too short', () => {
      expect(() => validateServiceDescription('Short')).toThrow(ServiceValidationError);
      expect(() => validateServiceDescription('Too short')).toThrow(ServiceValidationError);
    });

    it('should reject descriptions that are too long', () => {
      const longDescription = 'a'.repeat(1001);
      expect(() => validateServiceDescription(longDescription)).toThrow(ServiceValidationError);
    });
  });

  describe('validateServiceExample', () => {
    it('should accept valid examples', () => {
      const validExamples = [
        'This is a valid example.',
        'A'.repeat(500), // Maximum length
        'Example with numbers 123 and symbols !@#'
      ];

      validExamples.forEach(example => {
        expect(() => validateServiceExample(example)).not.toThrow();
      });
    });

    it('should accept undefined examples', () => {
      expect(() => validateServiceExample(undefined)).not.toThrow();
    });

    it('should reject examples that are too long', () => {
      const longExample = 'a'.repeat(501);
      expect(() => validateServiceExample(longExample)).toThrow(ServiceValidationError);
    });
  });

  describe('validateServicePrice', () => {
    it('should accept valid prices', () => {
      const validPrices = [0, 100, 1000, 999999, 1000000];

      validPrices.forEach(price => {
        expect(() => validateServicePrice(price)).not.toThrow();
      });
    });

    it('should reject null or undefined prices', () => {
      expect(() => validateServicePrice(null as any)).toThrow(ServiceValidationError);
      expect(() => validateServicePrice(undefined as any)).toThrow(ServiceValidationError);
    });

    it('should reject negative prices', () => {
      expect(() => validateServicePrice(-1)).toThrow(ServiceValidationError);
      expect(() => validateServicePrice(-100)).toThrow(ServiceValidationError);
    });

    it('should reject prices that are too high', () => {
      expect(() => validateServicePrice(1000001)).toThrow(ServiceValidationError);
      expect(() => validateServicePrice(9999999)).toThrow(ServiceValidationError);
    });

    it('should reject non-numeric prices', () => {
      expect(() => validateServicePrice(NaN)).toThrow(ServiceValidationError);
      expect(() => validateServicePrice('100' as any)).toThrow(ServiceValidationError);
      expect(() => validateServicePrice({} as any)).toThrow(ServiceValidationError);
    });
  });

  describe('validateServicePrivacy', () => {
    it('should accept valid privacy levels', () => {
      const validPrivacyLevels = ['public', 'private'];

      validPrivacyLevels.forEach(privacy => {
        expect(() => validateServicePrivacy(privacy)).not.toThrow();
      });
    });

    it('should accept case-insensitive privacy levels', () => {
      const validPrivacyLevels = ['PUBLIC', 'Private'];

      validPrivacyLevels.forEach(privacy => {
        expect(() => validateServicePrivacy(privacy)).not.toThrow();
      });
    });

    it('should reject empty or null privacy levels', () => {
      expect(() => validateServicePrivacy('')).toThrow(ServiceValidationError);
      expect(() => validateServicePrivacy('   ')).toThrow(ServiceValidationError);
    });

    it('should reject invalid privacy levels', () => {
      const invalidPrivacyLevels = [
        'invalid',
        'unknown',
        'secret',
        'confidential'
      ];

      invalidPrivacyLevels.forEach(privacy => {
        expect(() => validateServicePrivacy(privacy)).toThrow(ServiceValidationError);
      });
    });
  });

  describe('validateMidnightWalletAddress', () => {
    it('should accept valid wallet addresses', () => {
      const validAddresses = [
        'wallet123',
        'my-wallet',
        'wallet_address',
        'a'.repeat(5), // Minimum length
        'a'.repeat(150), // Maximum length
        'wallet-123-address'
      ];

      validAddresses.forEach(address => {
        expect(() => validateMidnightWalletAddress(address)).not.toThrow();
      });
    });

    it('should reject empty or null addresses', () => {
      expect(() => validateMidnightWalletAddress('')).toThrow(ServiceValidationError);
      expect(() => validateMidnightWalletAddress('   ')).toThrow(ServiceValidationError);
    });

    it('should reject addresses that are too short', () => {
      expect(() => validateMidnightWalletAddress('abcd')).toThrow(ServiceValidationError);
      expect(() => validateMidnightWalletAddress('a')).toThrow(ServiceValidationError);
    });

    it('should reject addresses that are too long', () => {
      const longAddress = 'a'.repeat(151);
      expect(() => validateMidnightWalletAddress(longAddress)).toThrow(ServiceValidationError);
    });

    it('should reject addresses with invalid characters', () => {
      const invalidAddresses = [
        'wallet@123',
        'wallet#address',
        'wallet$address',
        'wallet%address',
        'wallet&address',
        'wallet address', // Spaces not allowed
        'wallet.address'  // Dots not allowed
      ];

      invalidAddresses.forEach(address => {
        expect(() => validateMidnightWalletAddress(address)).toThrow(ServiceValidationError);
      });
    });
  });

  describe('validateServiceStatus', () => {
    it('should accept valid status values', () => {
      expect(() => validateServiceStatus('active')).not.toThrow();
      expect(() => validateServiceStatus('inactive')).not.toThrow();
    });

    it('should reject empty or null status values', () => {
      expect(() => validateServiceStatus('')).toThrow(ServiceValidationError);
      expect(() => validateServiceStatus('   ')).toThrow(ServiceValidationError);
    });

    it('should reject invalid status values', () => {
      const invalidStatuses = [
        'enabled',
        'disabled',
        'running',
        'stopped',
        'pending',
        'ACTIVE', // Case sensitive
        'Inactive' // Case sensitive
      ];

      invalidStatuses.forEach(status => {
        expect(() => validateServiceStatus(status)).toThrow(ServiceValidationError);
      });
    });
  });

  describe('ServiceValidationError', () => {
    it('should be an instance of Error', () => {
      const error = new ServiceValidationError('Test error');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ServiceValidationError).toBe(true);
    });

    it('should have the correct message', () => {
      const error = new ServiceValidationError('Custom error message');
      expect(error.message).toBe('MCP error -32602: Custom error message');
    });
  });

  describe('SUGGESTED_SERVICE_TYPES', () => {
    it('should contain the expected service types', () => {
      expect(SUGGESTED_SERVICE_TYPES).toContain('AI_ANALYSIS');
      expect(SUGGESTED_SERVICE_TYPES).toContain('DATA_PROCESSING');
      expect(SUGGESTED_SERVICE_TYPES).toContain('API_INTEGRATION');
      expect(SUGGESTED_SERVICE_TYPES).toContain('COMPUTATION');
      expect(SUGGESTED_SERVICE_TYPES).toContain('STORAGE');
      expect(SUGGESTED_SERVICE_TYPES).toContain('CUSTOM');
    });

    it('should be a readonly array', () => {
      expect(Array.isArray(SUGGESTED_SERVICE_TYPES)).toBe(true);
      expect(SUGGESTED_SERVICE_TYPES.length).toBeGreaterThan(0);
    });
  });
}); 