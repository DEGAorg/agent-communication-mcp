export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: [
    '**/test/**/*.spec.ts',
    '**/test/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/test/state/manager.test.ts',
    '<rootDir>/src/stdio-server.ts'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    // Exclude files that require complex integration testing or have file system dependencies
    '!src/stdio-server.ts',     // Main server entry point - requires full environment setup
    '!src/tools.ts',            // Tool handler with multiple service dependencies - requires integration tests
    '!src/state/manager.ts',    // State manager with file system dependencies - requires integration tests
    // Exclude files that are in testPathIgnorePatterns
    '!src/api/wallet-api.ts',
    '!src/errors/errorHandler.ts',
    '!src/supabase/auth.ts',
    '!src/supabase/message-handler.ts',
    '!src/supabase/message-helper.ts',
    '!src/supabase/service.ts',
    '!src/supabase/types.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol)/)'
  ],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  // Istanbul coverage exclusions for error handling code that's difficult to test
  coveragePathIgnorePatterns: [
    // CLI tools that require full environment setup
    'src/cli/',
    // Scripts that are run independently
    'scripts/',
    // ZK proofs and complex cryptographic operations
    'src/zk/',
    // Test files
    'test/',
    // Type definitions
    '\\.d\\.ts$'
  ]
}; 