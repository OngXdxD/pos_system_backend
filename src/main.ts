import { config as loadEnv } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

loadEnv();

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

function parseCorsOrigins(): Set<string> {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return new Set(LOCAL_DEV_ORIGINS);
  }
  return new Set(raw.split(',').map((o) => o.trim()).filter(Boolean));
}

const corsAllowAll =
  process.env.CORS_ALLOW_ALL === 'true' || process.env.CORS_ALLOW_ALL === '1';
const corsOrigins = parseCorsOrigins();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: corsAllowAll
      ? true
      : (origin, callback) => {
          if (!origin || corsOrigins.has(origin)) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
  console.log(`POS API running at http://localhost:${process.env.PORT ?? 3000}/api`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
