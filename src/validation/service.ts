import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../logger.js';
import { SERVICE_PRIVACY_LEVELS } from '../supabase/message-types.js';

// Suggested service types for guidance
export const SUGGESTED_SERVICE_TYPES = [
  'AI_ANALYSIS',
  'DATA_PROCESSING',
  'API_INTEGRATION',
  'COMPUTATION',
  'STORAGE',
  'CUSTOM'
] as const;

// Validation constants
const VALIDATION_RULES = {
  name: {
    minLength: 3,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_]+$/
  },
  service_id: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-z0-9\-_]+$/
  },
  type: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    suggestedTypes: SUGGESTED_SERVICE_TYPES
  },
  description: {
    minLength: 10,
    maxLength: 1000
  },
  example: {
    maxLength: 500
  },
  price: {
    min: 0,
    max: 1000000
  },
  privacy: {
    allowedValues: Object.values(SERVICE_PRIVACY_LEVELS)
  },
  midnight_wallet_address: {
    minLength: 5,
    maxLength: 150,  // Increased to accommodate the example address length
    pattern: /^[a-zA-Z0-9\-_]+$/  // Allow alphanumeric, hyphens, and underscores
  },
  status: {
    allowedValues: ['active', 'inactive']
  }
} as const;

export class ServiceValidationError extends McpError {
  constructor(message: string) {
    super(ErrorCode.InvalidParams, message);
  }
}

export function validateServiceName(name: string): void {
  if (!name) {
    throw new ServiceValidationError('Service name is required');
  }
  
  if (name.length < VALIDATION_RULES.name.minLength) {
    throw new ServiceValidationError(`Service name must be at least ${VALIDATION_RULES.name.minLength} characters long`);
  }
  
  if (name.length > VALIDATION_RULES.name.maxLength) {
    throw new ServiceValidationError(`Service name must not exceed ${VALIDATION_RULES.name.maxLength} characters`);
  }
  
  if (!VALIDATION_RULES.name.pattern.test(name)) {
    throw new ServiceValidationError('Service name can only contain letters, numbers, spaces, hyphens, and underscores');
  }
}

export function validateServiceId(serviceId: string): void {
  if (!serviceId) {
    throw new ServiceValidationError('Service ID is required');
  }
  
  if (serviceId.length < VALIDATION_RULES.service_id.minLength) {
    throw new ServiceValidationError(`Service ID must be at least ${VALIDATION_RULES.service_id.minLength} characters long`);
  }
  
  if (serviceId.length > VALIDATION_RULES.service_id.maxLength) {
    throw new ServiceValidationError(`Service ID must not exceed ${VALIDATION_RULES.service_id.maxLength} characters`);
  }
  
  if (!VALIDATION_RULES.service_id.pattern.test(serviceId)) {
    throw new ServiceValidationError('Service ID can only contain lowercase letters, numbers, hyphens, and underscores');
  }
}

export function validateServiceType(type: string): void {
  if (!type) {
    throw new ServiceValidationError('Service type is required');
  }
  
  if (type.length < VALIDATION_RULES.type.minLength) {
    throw new ServiceValidationError(`Service type must be at least ${VALIDATION_RULES.type.minLength} characters long`);
  }
  
  if (type.length > VALIDATION_RULES.type.maxLength) {
    throw new ServiceValidationError(`Service type must not exceed ${VALIDATION_RULES.type.maxLength} characters`);
  }
  
  if (!VALIDATION_RULES.type.pattern.test(type)) {
    throw new ServiceValidationError('Service type can only contain letters, numbers, and underscores');
  }

  // Convert to uppercase for comparison with suggested types
  const upperType = type.toUpperCase();
  if (!VALIDATION_RULES.type.suggestedTypes.includes(upperType as typeof SUGGESTED_SERVICE_TYPES[number])) {
    logger.warn(`Service type "${type}" is not in the suggested types list. Suggested types are: ${VALIDATION_RULES.type.suggestedTypes.join(', ')}`);
  }
}

export function validateServiceDescription(description: string): void {
  if (!description) {
    throw new ServiceValidationError('Service description is required');
  }
  
  if (description.length < VALIDATION_RULES.description.minLength) {
    throw new ServiceValidationError(`Service description must be at least ${VALIDATION_RULES.description.minLength} characters long`);
  }
  
  if (description.length > VALIDATION_RULES.description.maxLength) {
    throw new ServiceValidationError(`Service description must not exceed ${VALIDATION_RULES.description.maxLength} characters`);
  }
}

export function validateServiceExample(example: string | undefined): void {
  if (example && example.length > VALIDATION_RULES.example.maxLength) {
    throw new ServiceValidationError(`Service example must not exceed ${VALIDATION_RULES.example.maxLength} characters`);
  }
}

export function validateServicePrice(price: number): void {
  if (price === undefined || price === null) {
    throw new ServiceValidationError('Service price is required');
  }
  
  if (typeof price !== 'number' || isNaN(price)) {
    throw new ServiceValidationError('Service price must be a valid number');
  }
  
  if (price < VALIDATION_RULES.price.min) {
    throw new ServiceValidationError(`Service price must be at least ${VALIDATION_RULES.price.min}`);
  }
  
  if (price > VALIDATION_RULES.price.max) {
    throw new ServiceValidationError(`Service price must not exceed ${VALIDATION_RULES.price.max}`);
  }
}

export function validateServicePrivacy(privacy: string): void {
  if (!privacy) {
    throw new ServiceValidationError('Service privacy level is required');
  }

  const normalizedPrivacy = privacy.toLowerCase();
  if (!VALIDATION_RULES.privacy.allowedValues.includes(normalizedPrivacy as typeof SERVICE_PRIVACY_LEVELS[keyof typeof SERVICE_PRIVACY_LEVELS])) {
    throw new ServiceValidationError(`Invalid privacy level. Must be one of: ${VALIDATION_RULES.privacy.allowedValues.join(', ')}`);
  }
}

export function validateMidnightWalletAddress(address: string): void {
  if (!address) {
    throw new ServiceValidationError('Midnight wallet address is required');
  }
  
  if (address.length < VALIDATION_RULES.midnight_wallet_address.minLength) {
    throw new ServiceValidationError('Midnight wallet address is too short');
  }
  
  if (address.length > VALIDATION_RULES.midnight_wallet_address.maxLength) {
    throw new ServiceValidationError('Midnight wallet address is too long');
  }
  
  if (!VALIDATION_RULES.midnight_wallet_address.pattern.test(address)) {
    throw new ServiceValidationError('Midnight wallet address can only contain letters, numbers, hyphens, and underscores');
  }
}

export function validateServiceStatus(status: string): void {
  if (!status) {
    throw new ServiceValidationError('Service status is required');
  }
  
  if (!VALIDATION_RULES.status.allowedValues.includes(status as 'active' | 'inactive')) {
    throw new ServiceValidationError(`Invalid status. Must be one of: ${VALIDATION_RULES.status.allowedValues.join(', ')}`);
  }
}

export function validateService(service: {
  name: string;
  type: string;
  example?: string;
  price: number;
  description: string;
  privacy_settings: {
    privacy: string;
    conditions?: {
      text: string;
      privacy: string;
    };
  };
  midnight_wallet_address: string;
  status?: 'active' | 'inactive';
}): void {
  validateServiceName(service.name);
  validateServiceType(service.type);
  validateServiceDescription(service.description);
  validateServiceExample(service.example);
  validateServicePrice(service.price);
  if (service.privacy_settings?.privacy) {
    validateServicePrivacy(service.privacy_settings.privacy);
  }
  validateMidnightWalletAddress(service.midnight_wallet_address);
  
  // If status is provided, validate it
  if (service.status) {
    validateServiceStatus(service.status);
  } else {
    // Force status to be 'inactive' for new services
    service.status = 'inactive';
  }
}

export interface ServiceFilters {
  topics?: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  serviceType?: string | null;
  includeInactive?: boolean;
}

export function validateServiceFilters(filters: ServiceFilters): void {
  const { minPrice, maxPrice, serviceType } = filters;

  // Validate minPrice if provided
  if (minPrice !== null && minPrice !== undefined) {
    if (typeof minPrice !== 'number' || isNaN(minPrice)) {
      throw new ServiceValidationError('minPrice must be a valid number when provided');
    }
    if (minPrice < VALIDATION_RULES.price.min) {
      throw new ServiceValidationError(`minPrice must be at least ${VALIDATION_RULES.price.min}`);
    }
    if (minPrice > VALIDATION_RULES.price.max) {
      throw new ServiceValidationError(`minPrice must not exceed ${VALIDATION_RULES.price.max}`);
    }
  }

  // Validate maxPrice if provided
  if (maxPrice !== null && maxPrice !== undefined) {
    if (typeof maxPrice !== 'number' || isNaN(maxPrice)) {
      throw new ServiceValidationError('maxPrice must be a valid number when provided');
    }
    if (maxPrice < VALIDATION_RULES.price.min) {
      throw new ServiceValidationError(`maxPrice must be at least ${VALIDATION_RULES.price.min}`);
    }
    if (maxPrice > VALIDATION_RULES.price.max) {
      throw new ServiceValidationError(`maxPrice must not exceed ${VALIDATION_RULES.price.max}`);
    }
  }

  // Validate price range if both are provided
  if (minPrice !== null && maxPrice !== null && typeof minPrice === 'number' && typeof maxPrice === 'number') {
    if (minPrice > maxPrice) {
      throw new ServiceValidationError('minPrice cannot be greater than maxPrice');
    }
  }

  // Validate serviceType if provided
  if (serviceType !== null && serviceType !== undefined) {
    if (typeof serviceType !== 'string') {
      throw new ServiceValidationError('serviceType must be a string when provided');
    }
    if (serviceType.length < VALIDATION_RULES.type.minLength) {
      throw new ServiceValidationError(`serviceType must be at least ${VALIDATION_RULES.type.minLength} characters long`);
    }
    if (serviceType.length > VALIDATION_RULES.type.maxLength) {
      throw new ServiceValidationError(`serviceType must not exceed ${VALIDATION_RULES.type.maxLength} characters`);
    }
    if (!VALIDATION_RULES.type.pattern.test(serviceType)) {
      throw new ServiceValidationError('serviceType can only contain letters, numbers, and underscores');
    }
  }
} 