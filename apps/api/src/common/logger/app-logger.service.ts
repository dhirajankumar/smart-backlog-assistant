import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { join } from 'path';

const VALID_LEVELS = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

function resolveLevel(): string {
  const env = process.env['LOG_LEVEL']?.toLowerCase() ?? 'info';
  return VALID_LEVELS.includes(env) ? env : 'info';
}

function buildTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

const logFormat = winston.format.printf(({ level, message, context, timestamp }) => {
  const ctx = context ? ` [${context}]` : '';
  return `[${timestamp}] [${level.toUpperCase()}]${ctx} ${message}`;
});

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: winston.Logger;
  readonly logFilePath: string;

  constructor() {
    const level = resolveLevel();
    this.logFilePath = join(process.cwd(), 'logs', `run-${buildTimestamp()}.log`);

    const fileTransport = new winston.transports.File({
      filename: this.logFilePath,
      handleExceptions: false,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    });

    fileTransport.on('error', (err: Error) => {
      console.warn(`[AppLogger] Log file write failed: ${err.message}`);
    });

    this.logger = winston.createLogger({
      level,
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            logFormat,
          ),
        }),
        fileTransport,
      ],
    });
  }

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(trace ? `${message} — ${trace}` : message, { context });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }
}
