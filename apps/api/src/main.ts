import 'dotenv/config';
import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { RedisStore } from 'connect-redis';
import type { Express } from 'express';
import session from 'express-session';
import helmet from 'helmet';

import { loadEnvironment } from '../../../src/common/config/environment.js';
import { RedisService } from '../../../src/common/infrastructure/redis.service.js';
import { AppModule } from '../../../src/app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const environment = loadEnvironment();
  const redis = app.get(RedisService);
  await redis.connect();

  app.enableCsrfProtection({ trustedOrigins: [environment.webOrigin] });
  app.enableCors({
    credentials: true,
    origin: environment.webOrigin,
  });

  const expressApplication = app.getHttpAdapter().getInstance() as Express;
  expressApplication.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    session({
      cookie: {
        httpOnly: true,
        maxAge: environment.sessionIdleTimeoutMs,
        sameSite: 'strict',
        secure: environment.isProduction,
      },
      name: 'mediagnostics.sid',
      proxy: environment.isProduction,
      resave: false,
      rolling: true,
      saveUninitialized: false,
      secret: environment.sessionSecret,
      store: new RedisStore({
        client: redis.getClient(),
        prefix: 'mediagnostics:session:',
      }),
      unset: 'destroy',
    }),
  );
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mediagnostics API')
      .setDescription('Clinical document management API')
      .setVersion('1')
      .addCookieAuth('mediagnostics.sid')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(environment.apiPort, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.stack : String(error), 'Bootstrap');
  process.exitCode = 1;
});
