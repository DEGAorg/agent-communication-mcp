import { AppError } from './AppError.js';
import { logger } from '../logger.js';

/**
 * Shared error handling utility that:
 * 1. Logs the error using formatError
 * 2. Converts unexpected errors into AppError
 * 3. Always throws an AppError upward
 */
export function handleError(context: string, error: unknown): never {
  // Log the error with full details
  logger.error({
    msg: `Error ${context}`,
    error: error instanceof Error ? error.message : 'Unknown error',
    details: error instanceof Error ? error.stack : String(error),
    context: {
      operation: context,
      timestamp: new Date().toISOString()
    }
  });

  // If it's already an AppError, just rethrow it
  if (error instanceof AppError) {
    throw error;
  }

  // Convert unknown errors to AppError
  throw new AppError(
    error instanceof Error ? error.message : String(error),
    'INTERNAL_ERROR',
    500,
    error
  );
}

/**
 * Formats an error for API responses
 * @param error The error to format
 * @returns A sanitized error message safe for end users
 */
export function formatErrorForResponse(error: unknown): { message: string; statusCode: number } {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode
    };
  }

  // For unknown errors, return a generic message
  return {
    message: 'An unexpected error occurred',
    statusCode: 500
  };
}

/**
 * Wraps a function with error handling
 * @param fn The function to wrap
 * @param context The context for error messages
 * @returns A wrapped function that handles errors
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  return fn().catch((error: unknown) => {
    throw handleError(context, error);
  });
} 