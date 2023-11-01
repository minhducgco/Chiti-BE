import * as dotenv from 'dotenv';
dotenv.config();
import * as config from 'config';
import * as helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModules } from 'src/app.module';
import { BodyValidationPipe } from 'src/shares/pipes/body.validation.pipe';
import { HttpExceptionFilter } from 'src/shares/filters/http-exception.filter';
import { SentryInterceptor } from 'src/shares/interceptors/sentry.interceptor';
import { ResponseTransformInterceptor } from 'src/shares/interceptors/response.interceptor';

const appPort = config.get<number>('app.port');
const prefix = config.get<string>('app.prefix');
const appEnv = config.get<string>('app.node_env');
const dnsSentry = config.get<string>('sentry_dns');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModules, {
    cors: true,
  });
  Sentry.init({
    dsn: dnsSentry,
    environment: appEnv,
  });
  app.enableCors();
  app.use(helmet());
  app.setGlobalPrefix(prefix);
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new BodyValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new SentryInterceptor());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  const appName = config.get<string>('app.name');
  const options = new DocumentBuilder()
    .addBearerAuth()
    .setTitle(appName)
    .setDescription(appName)
    .setVersion(prefix)
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    customSiteTitle: appName,
    swaggerOptions: {
      filter: true,
      docExpansion: 'list',
      displayRequestDuration: true,
    },
  });
  await app.listen(appPort);
  const logger = app.get(Logger);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
