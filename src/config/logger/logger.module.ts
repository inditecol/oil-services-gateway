import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isDevelopment = configService.get('NODE_ENV') !== 'production';
        const logLevel = configService.get('LOG_LEVEL', isDevelopment ? 'debug' : 'info');

        return {
          pinoHttp: {
            level: logLevel,
            transport: isDevelopment
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    singleLine: false,
                  },
                }
              : undefined,
            serializers: {
              req: (req) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
              }),
              res: (res) => ({
                statusCode: res.statusCode,
              }),
              err: (err) => ({
                type: err.type,
                message: err.message,
                stack: err.stack,
              }),
            },
            customLogLevel: (req, res, err) => {
              if (res.statusCode >= 400 && res.statusCode < 500) {
                return 'warn';
              } else if (res.statusCode >= 500 || err) {
                return 'error';
              }
              return 'info';
            },
            customSuccessMessage: (req, res) => {
              return `${req.method} ${req.url} - ${res.statusCode}`;
            },
            customErrorMessage: (req, res, err) => {
              return `${req.method} ${req.url} - ${res.statusCode} - ${err.message}`;
            },
            autoLogging: {
              ignore: (req) => {
                return req.url === '/health' || req.url === '/graphql';
              },
            },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}

