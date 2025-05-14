import { pino } from 'pino';
import { config } from './config.js';

const transport = config.logFile
  ? {
      targets: [
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
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
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };

export const logger = pino({
  level: config.logLevel,
  transport,
}); 