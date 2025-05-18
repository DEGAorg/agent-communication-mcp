# Logging Best Practices

This document outlines the logging standards and best practices for the Agent Communication MCP project.

## Log Levels

Use the appropriate log level for different types of messages:

- `error`: For errors that need immediate attention
- `warn`: For potentially harmful situations
- `info`: For general operational information
- `debug`: For detailed debugging information

## Log Format

### Info and Debug Logs

Keep info and debug logs simple and direct. Avoid using context objects for routine information.

```typescript
// ✅ Good
logger.info('Starting server');
logger.info(`Processing ${count} messages`);
logger.info(`Service registered: ${serviceName}`);

// ❌ Avoid
logger.info({
  msg: 'Starting server',
  context: {
    version: '1.0.0',
    timestamp: '...'
  }
});
```

### Error Logs

Use structured logging for errors with detailed context:

```typescript
logger.error({
  msg: 'Failed to initialize system',
  error: error instanceof Error ? error.message : 'Unknown error',
  details: error instanceof Error ? error.stack : String(error),
  context: {
    operation: 'system_initialization',
    state: currentState,
    timestamp: new Date().toISOString()
  }
});
```

## State Changes

For state transitions, use a simple format:

```typescript
// ✅ Good
logger.info(`System state changed: ${previousState} -> ${newState}`);

// ❌ Avoid
logger.info({
  msg: 'System state changed',
  context: {
    previousState,
    newState,
    timestamp: '...'
  }
});
```

## Error Handling

1. Always include:
   - Error message
   - Stack trace (if available)
   - Operation context
   - Timestamp
   - Relevant IDs or state information

2. For API errors, include:
   - Error code
   - Error details
   - Request context

```typescript
try {
  // Operation
} catch (error) {
  logger.error({
    msg: 'Operation failed',
    error: error instanceof Error ? error.message : 'Unknown error',
    details: error instanceof Error ? error.stack : String(error),
    context: {
      operation: 'operation_name',
      id: resourceId,
      timestamp: new Date().toISOString()
    }
  });
  throw error;
}
```

## Common Patterns

### Service Operations

```typescript
// Start operation
logger.info(`Starting ${operationName}`);

// Success
logger.info(`${operationName} completed successfully`);

// Error
logger.error({
  msg: `${operationName} failed`,
  error: error.message,
  details: error.stack,
  context: {
    operation: operationName,
    resourceId,
    timestamp: new Date().toISOString()
  }
});
```

### Authentication

```typescript
// Success
logger.info('Successfully authenticated');
logger.info(`Agent registered: ${agentName}`);

// Error
logger.error({
  msg: 'Authentication failed',
  error: error.message,
  details: error.stack,
  context: {
    operation: 'authentication',
    email,
    timestamp: new Date().toISOString()
  }
});
```

## Best Practices

1. **Keep it Simple**: Use direct messages for routine operations
2. **Be Specific**: Include relevant identifiers in log messages
3. **Structured Errors**: Always use structured logging for errors
4. **Context Matters**: Include operation context in error logs
5. **Timestamps**: Always include timestamps in error contexts
6. **Avoid Clutter**: Don't log unnecessary information
7. **Consistent Format**: Use consistent message formats across the application

## Examples

### Good Examples

```typescript
// Simple info
logger.info('Server started');
logger.info(`Processing message ${messageId}`);

// State change
logger.info(`State changed: ${oldState} -> ${newState}`);

// Error with context
logger.error({
  msg: 'Failed to process message',
  error: error.message,
  details: error.stack,
  context: {
    messageId,
    operation: 'message_processing',
    timestamp: new Date().toISOString()
  }
});
```

### Bad Examples

```typescript
// Too verbose
logger.info({
  msg: 'Server started',
  context: {
    version: '1.0.0',
    timestamp: '...',
    platform: '...'
  }
});

// Missing context
logger.error('Failed to process message');

// Inconsistent format
logger.info('State changed:', { oldState, newState });
```

## Configuration

The logger is configured in `src/logger.ts` with the following settings:

- Single line output
- Timestamp format: HH:MM:ss
- Error properties: message, stack, code, type, details, context
- Colorized output in development

## Maintenance

When adding new logging statements:

1. Consider the log level carefully
2. Keep info logs simple and direct
3. Include proper context in error logs
4. Follow the established patterns
5. Test the log output to ensure readability 