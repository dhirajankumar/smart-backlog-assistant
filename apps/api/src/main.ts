import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { AppModule } from './app/app.module';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  await ConfigModule.forRoot({ isGlobal: true });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}/api — logs: ${logger.logFilePath}`, 'Bootstrap');
}

bootstrap();
