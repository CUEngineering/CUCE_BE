import * as path from 'node:path';
import * as process from 'node:process';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as fs from 'fs-extra';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const apiVersion = configService.get<string>('API_VERSION') || 'v1';
  const globalPrefix = `api/${apiVersion}`;

  // Set global prefix
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: 'test-db', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  const allowedOrigins = configService
    .get<string>('CORS_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins?.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const port = configService.get<number>('PORT') || 3000;
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.listen(port);
  console.log(`App is listening on port ${port}`);

  const src = path.join(__dirname, '..', 'templates');
  const dest = path.join(__dirname, 'templates');

  try {
    await fs.copy(src, dest);
    console.log('✅ Template directory copied to dist/template');
  } catch (err) {
    console.error('❌ Failed to copy template directory:', err);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
