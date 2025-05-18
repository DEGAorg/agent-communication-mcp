import { pino } from 'pino';
import { config } from './config.js';

interface ErrorObject {
  message: string;
  stack?: string;
  code?: string | number;
  type?: string;
  details?: string;
  context?: Record<string, unknown>;
  cause?: unknown;
}

const transport = config.logFile
  ? {
      targets: [
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{msg}',
            errorLikeObjectKeys: ['err', 'error'],
            errorProps: 'message,stack,code,type,details,context',
            singleLine: true,
            messageKey: 'msg'
          },
        },
        {
          target: 'pino/file',
          options: {
            destination: config.logFile,
            mkdir: true,
          },
        },
      ],
    }
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        errorLikeObjectKeys: ['err', 'error'],
        errorProps: 'message,stack,code,type,details,context',
        singleLine: true,
        messageKey: 'msg'
      },
    };

export const logger = pino({
  level: config.logLevel,
  transport,
  serializers: {
    err: (err) => {
      if (!err) return err;
      const errorObj: ErrorObject = {
        message: err.message || 'Unknown error',
        stack: err.stack,
        code: err.code,
        type: err.type,
      };

      if (err.details) {
        errorObj.details = err.details;
      }
      if (err.context) {
        errorObj.context = err.context;
      }
      if (err.cause) {
        errorObj.cause = err.cause;
      }

      return errorObj;
    }
  }
}); 