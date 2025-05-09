import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../logger.js';

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
    pattern: /^[A-Z0-9_]+$/
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
    throw new ServiceValidationError('Service type can only contain uppercase letters, numbers, and underscores');
  }

  // If the type is not in the suggested list, log a warning but don't reject it
  if (!SUGGESTED_SERVICE_TYPES.includes(type as any)) {
    logger.warn(`Service type "${type}" is not in the suggested list. Suggested types are: ${SUGGESTED_SERVICE_TYPES.join(', ')}`);
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

export function validateService(service: {
  name: string;
  service_id: string;
  type: string;
  example?: string;
  price: number;
  description: string;
}): void {
  validateServiceName(service.name);
  validateServiceId(service.service_id);
  validateServiceType(service.type);
  validateServiceDescription(service.description);
  validateServiceExample(service.example);
  validateServicePrice(service.price);
} 