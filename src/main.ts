import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';

let cachedApp: INestApplication;

async function createApp(): Promise<INestApplication> {
  if (cachedApp) return cachedApp;
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();
  cachedApp = app;
  return app;
}

// Vercel serverless handler — Vercel imports this file and calls the default export
export default async function handler(req: unknown, res: unknown) {
  const app = await createApp();
  const server = app.getHttpAdapter().getInstance() as (req: unknown, res: unknown) => void;
  server(req, res);
}

// Local development — only start the HTTP server when NOT on Vercel
if (!process.env.VERCEL) {
  createApp()
    .then(async (app) => {
      const port = process.env.PORT ?? 3000;
      await app.listen(port);
      console.log(`POS API running at http://localhost:${port}/api`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
