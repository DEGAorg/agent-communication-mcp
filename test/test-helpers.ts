import { jest } from '@jest/globals';

// Shared test helpers for mocking logger and config

export const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mutable config mock for per-test mutation
export const mutableConfig = {
  walletMcpUrl: 'http://localhost:3001',
};

export function resetTestMocks() {
  jest.clearAllMocks();
  // Reset config to default
  mutableConfig.walletMcpUrl = 'http://localhost:3001';
} 