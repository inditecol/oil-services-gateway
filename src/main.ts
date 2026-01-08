import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupConsoleInterceptor } from './config/logger/console-interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Obtener el logger de Pino para NestJS
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Interceptar console.log, console.warn, console.error para redirigirlos a Pino
  setupConsoleInterceptor(logger);

  // Configurar CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  // Configurar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  
  logger.log(`🚀 Aplicación ejecutándose en: http://localhost:${port}`);
  logger.log(`📊 GraphQL Playground disponible en: http://localhost:${port}/graphql`);
}

bootstrap(); 