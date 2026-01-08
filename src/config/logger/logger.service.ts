import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(private readonly pinoLogger: PinoLogger) {}

  log(message: any, context?: string) {
    this.pinoLogger.info({ context }, message);
  }

  error(message: any, trace?: string, context?: string) {
    this.pinoLogger.error({ context, trace }, message);
  }

  warn(message: any, context?: string) {
    this.pinoLogger.warn({ context }, message);
  }

  debug(message: any, context?: string) {
    this.pinoLogger.debug({ context }, message);
  }

  verbose(message: any, context?: string) {
    this.pinoLogger.trace({ context }, message);
  }

  fatal(message: any, context?: string) {
    this.pinoLogger.fatal({ context }, message);
  }
}

