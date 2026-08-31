import 'reflect-metadata';

import helmet from 'helmet';
import passport from 'passport';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import type { Express } from 'express';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, VersioningType, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi/openapi-document';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const isProduction = config.getOrThrow<string>('NODE_ENV') === 'production';
  const sessionTtlSeconds = config.getOrThrow<number>('SESSION_TTL_SECONDS');
  const PgSessionStore = connectPgSimple(session);

  if (isProduction) {
    const expressApp = app.getHttpAdapter().getInstance() as Express;
    expressApp.set('trust proxy', 1);
  }

  app.use(
    session({
      name: 'kanban.sid',
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      store: new PgSessionStore({
        conString: config.getOrThrow<string>('DATABASE_URL'),
        tableName: 'http_sessions',
        ttl: sessionTtlSeconds,
        createTableIfMissing: false,
      }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: sessionTtlSeconds * 1000,
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'mcp', method: RequestMethod.ALL },
    ],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('APP_ORIGIN'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.enableShutdownHooks();

  SwaggerModule.setup('api/docs', app, createOpenApiDocument(app));

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
