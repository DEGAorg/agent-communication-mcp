import { pino } from 'pino';
import { config } from './config.js';
import { FileManager, FileType } from './utils/file-manager.js';

/**
 * Available log levels in ascending order of importance.
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /**
   * Log level to use
   * @default 'info'
   */
  level?: LogLevel;
  
  /**
   * Enable pretty printing for development
   * @default true
   */
  pretty?: boolean;
  
  /**
   * Optional output file path to write logs to
   */
  outputFile?: string;
  
  /**
   * Include additional standard fields with each log
   */
  standardFields?: {
    /**
     * Application or service name
     */
    application?: string;
    
    /**
     * Environment (e.g., production, development, staging)
     */
    environment?: string;
    
    /**
     * Version of the application
     */
    version?: string;
    
    /**
     * Agent ID for multi-agent setups
     */
    agentId?: string;
    
    /**
     * Custom fields to include with every log
     */
    custom?: Record<string, any>;
  };
}

/**
 * Global logger configuration that can be modified
 */
export const LoggerConfig = {
  /**
   * Default log level for all loggers
   */
  defaultLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  
  /**
   * Enable pretty printing by default
   */
  prettyPrint: true,
  
  /**
   * Enable file output by default
   */
  enableFileOutput: true,
  
  /**
   * Default log file location
   */
  defaultLogFile: 'comms-app.log',
  
  /**
   * Standard fields to include with all logs
   */
  standardFields: {
    application: 'comms',
    environment: process.env.NODE_ENV || 'dev',
    version: process.env.APP_VERSION || '1',
  },
};

/**
 * Ensure the directory for a log file exists
 */
function ensureLogDirectoryExists(filePath: string): void {
  const fileManager = FileManager.getInstance();
  const dirPath = filePath.split('/').slice(0, -1).join('/');
  fileManager.ensureDirectoryExists(dirPath);
}

/**
 * Create a logger instance with the provided configuration
 */
export function createLogger(name: string, options: LoggerOptions = {}): pino.Logger {
  const level = options.level || LoggerConfig.defaultLevel;
  const pretty = options.pretty ?? LoggerConfig.prettyPrint;
  
  // Prepare standard fields
  const standardFields = {
    ...LoggerConfig.standardFields,
    ...options.standardFields,
  };

  // Get agent ID from environment or standard fields
  const agentId = process.env.AGENT_ID || standardFields.agentId || 'system';
  
  // Base logger options
  const baseOptions: pino.LoggerOptions = {
    level,
    name,
    base: {
      n: standardFields.application,
      e: standardFields.environment,
      v: standardFields.version,
      a: agentId,
      ...standardFields.custom,
    },
  };

  // Configure transport targets
  const targets = [];

  // Add pretty console transport if enabled
  if (pretty) {
    targets.push({
      target: 'pino-pretty',
      level,
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        errorLikeObjectKeys: ['err', 'error'],
        errorProps: 'message,stack,code,type,details,context',
        singleLine: true,
        messageKey: 'msg'
      }
    });
  }
  
  // Add file transport if enabled
  if (LoggerConfig.enableFileOutput) {
    const outputFile = options.outputFile || LoggerConfig.defaultLogFile;
    const fileManager = FileManager.getInstance();
    const logPath = fileManager.getPath(FileType.LOG, agentId, outputFile);
    ensureLogDirectoryExists(logPath);
    
    targets.push({
      target: 'pino/file',
      level,
      options: {
        destination: logPath,
        mkdir: true,
        messageKey: 'msg',
        ignore: 'pid,hostname,name'
      }
    });
  }

  // Create logger with transport configuration
  return pino({
    ...baseOptions,
    transport: {
      targets
    }
  });
}

/**
 * Configure global logger settings
 */
export function configureGlobalLogging(options: {
  level?: LogLevel;
  prettyPrint?: boolean;
  enableFileOutput?: boolean;
  defaultLogFile?: string;
  standardFields?: typeof LoggerConfig.standardFields;
}): void {
  if (options.level) {
    LoggerConfig.defaultLevel = options.level;
  }
  
  if (options.prettyPrint !== undefined) {
    LoggerConfig.prettyPrint = options.prettyPrint;
  }
  
  if (options.enableFileOutput !== undefined) {
    LoggerConfig.enableFileOutput = options.enableFileOutput;
  }
  
  if (options.defaultLogFile) {
    LoggerConfig.defaultLogFile = options.defaultLogFile;
  }
  
  if (options.standardFields) {
    LoggerConfig.standardFields = {
      ...LoggerConfig.standardFields,
      ...options.standardFields,
    };
  }
}

/**
 * Default application logger
 */
export const logger = createLogger('midnight-mcp');

export default createLogger; 