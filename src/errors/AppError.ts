export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string = 'APP_ERROR',
    statusCode: number = 500,
    cause?: unknown
  ) {
    super(message);
    
    // Set the prototype explicitly
    Object.setPrototypeOf(this, AppError.prototype);
    
    // Set the error name
    this.name = 'AppError';
    
    // Set the custom properties
    this.code = code;
    this.statusCode = statusCode;

    // Normalize the cause
    if (cause instanceof Error) {
      this.cause = cause;
    } else if (typeof cause === 'string') {
      this.cause = new Error(cause);
    } else if (cause !== undefined) {
      this.cause = new Error('Unknown error');
    }
  }
}

/**
 * Formats an AppError into a JSON-serializable object
 * @param error The error to format
 * @returns A plain object containing the error details
 */
export function formatError(error: AppError): {
  name: string;
  message: string;
  code: string;
  statusCode: number;
  stack?: string;
  cause?: ReturnType<typeof formatError>;
} {
  const formatted: ReturnType<typeof formatError> = {
    name: error.name,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    stack: error.stack
  };

  if (error.cause) {
    formatted.cause = error.cause instanceof AppError
      ? formatError(error.cause)
      : {
          name: error.cause.name,
          message: error.cause.message,
          code: 'UNKNOWN',
          statusCode: 500,
          stack: error.cause.stack
        };
  }

  return formatted;
}

// Usage example:
/*
try {
  throw new AppError("Database connection failed", "DB_ERROR", 500);
} catch (err) {
  const wrapped = new AppError("Failed to load user", "USER_FETCH_ERROR", 500, err);
  console.error(formatError(wrapped));
}
*/ 