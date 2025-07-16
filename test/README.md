# Test Suite Documentation

This directory contains the comprehensive unit test suite for the Agent Communication MCP project. The tests are written using Jest and cover all major components of the system.

## Test Structure

### Setup and Configuration

- **`setup.ts`** - Test environment configuration that sets up required environment variables for testing
- **`test-helpers.ts`** - Shared test utilities including mock logger and config helpers

### Core Test Files

#### **`resources.test.ts`** (14KB, 358 lines)
Tests the MCP resource definitions and handlers:
- Resource structure validation (URI, name, description, MIME type, content)
- All predefined resources: agent info, services list, service registration, content management, payment processing, delivery management, data revelation, and available tools
- Resource content validation (JSON format, required fields)
- Resource handler functions (`handleListResources`, `handleReadResource`)
- Unique URI validation across all resources

#### **`prompt.test.ts`** (16KB, 473 lines)
Tests the prompt management system:
- Prompt definitions validation (name, description, arguments)
- All predefined prompts: status, login, listServices, registerService, storeServiceContent, servicePayment, queryServiceDelivery, provideServiceFeedback, disableService
- Prompt argument validation (required/optional fields)
- Dynamic prompt generation based on provided arguments
- Error handling for unknown prompts

#### **`wallet-service.test.ts`** (4.8KB, 138 lines)
Tests wallet-related utility functions:
- Random amount generation with proper formatting
- Amount format validation (6 decimal places, valid characters)
- Retry logic for generating valid amounts
- Edge case handling (zero amounts, large amounts)

#### **`validation-service.test.ts`** (13KB, 387 lines)
Tests input validation for service-related data:
- Service name validation (length, character restrictions)
- Service ID validation (format, uniqueness constraints)
- Service type validation (suggested types, custom types)
- Service description and example validation
- Price validation (format, range)
- Privacy settings validation
- Midnight wallet address validation
- Service status validation

#### **`encryption.test.ts`** (9.8KB, 280 lines)
Tests the encryption service functionality:
- X25519 key pair generation and management
- AES encryption/decryption with proper key handling
- Message encryption for multiple recipients
- Key encryption using recipient public keys
- Auditor key integration
- Error handling for invalid keys
- Cryptographic security validation

### Error Handling Tests

#### **`errors/app-error.test.ts`** (6.1KB, 175 lines)
Tests the custom error handling system:
- AppError class functionality
- Error message formatting
- Error type categorization
- Stack trace handling
- Error serialization

### Supabase Integration Tests

#### **`supabase/message-types.test.ts`** (13KB, 414 lines)
Tests Supabase database integration for message handling:
- Message type definitions and validation
- Database schema compliance
- CRUD operations for messages
- Message status tracking
- Error handling for database operations

### Utility Tests

#### **`utils/key-manager.integration.test.ts`** (8.7KB, 242 lines)
Integration tests for key management:
- Key generation and storage
- Key retrieval and validation
- Environment variable integration
- Key rotation and updates

#### **`utils/file-manager.test.ts`** (9.9KB, 259 lines)
Tests file system operations:
- File creation and deletion
- Directory management
- File content operations
- Error handling for file operations

#### **`utils/error-formatter.test.ts`** (2.9KB, 101 lines)
Tests error formatting utilities:
- Error message formatting
- Stack trace processing
- Error categorization
- User-friendly error messages

#### **`utils/server-config.test.ts`** (5.2KB, 179 lines)
Tests server configuration management:
- Environment variable validation
- Configuration object creation
- Default value handling
- Configuration validation

#### **`utils/auth-guard.test.ts`** (3.6KB, 122 lines)
Tests authentication guard functionality:
- Authentication state validation
- Permission checking
- Session management
- Access control logic

### Storage Tests

#### **`storage/service-content.test.ts`** (12KB, 373 lines)
Tests service content storage:
- Content creation and retrieval
- Version management
- Content validation
- Storage optimization

#### **`storage/received-content.test.ts`** (9.9KB, 310 lines)
Tests received content handling:
- Content reception and processing
- Content validation and sanitization
- Storage and retrieval operations
- Content metadata management

## Running Tests

### Prerequisites
- Node.js (version specified in package.json)
- Jest testing framework
- Required environment variables (configured in `setup.ts`)

### Test Commands
```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage

# Run specific test file
yarn test resources.test.ts

# Run tests matching a pattern
yarn test --testNamePattern="encryption"
```

### Environment Variables
The test suite requires the following environment variables (automatically set in `setup.ts`):
- `SUPABASE_URL` - Test Supabase instance URL
- `SUPABASE_ANON_KEY` - Test Supabase anonymous key
- `AGENT_ID` - Test agent identifier
- `WALLET_MCP_URL` - Test wallet MCP server URL
- `AGENT_PUBLIC_KEY` - Test agent public key
- `AGENT_PRIVATE_KEY` - Test agent private key
- `NODE_ENV` - Set to 'test'
- `LOG_LEVEL` - Set to 'error' for test output

## Test Patterns

### Mocking Strategy
- External dependencies are mocked using Jest
- Database operations use test doubles
- Cryptographic operations use test keys
- File system operations are isolated

### Test Organization
- Tests are organized by functionality
- Each test file focuses on a specific module
- Integration tests are separated from unit tests
- Error cases are thoroughly tested

### Assertion Patterns
- Jest matchers for type checking
- Custom matchers for complex objects
- Error throwing validation
- Async operation testing

## Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Include both positive and negative test cases
3. Mock external dependencies appropriately
4. Add tests for error conditions
5. Update this README if adding new test categories

## Troubleshooting

### Common Issues
- **Environment variables not set**: Ensure `setup.ts` is properly configured
- **Mock failures**: Check that external dependencies are properly mocked
- **Async test failures**: Ensure proper async/await usage and timeout configuration
- **Database connection issues**: Verify Supabase test configuration

### Debug Mode
Run tests with verbose output:
```bash
yarn test --verbose
```

### Coverage Reports
Generate detailed coverage reports:
```bash
yarn test:coverage
```

The coverage report will show which lines of code are tested and identify areas that need additional test coverage. 