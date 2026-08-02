import { NestFactory } from '@nestjs/core';
import { AppModule } from '../server/src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';

const server = express();

let app: any;
let isBootstrapping = false;
let bootstrapPromise: Promise<any> | null = null;

async function bootstrap() {
  if (app) return server;
  
  // Prevent concurrent bootstraps
  if (isBootstrapping && bootstrapPromise) return bootstrapPromise;
  
  isBootstrapping = true;
  bootstrapPromise = (async () => {
    try {
      app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
        logger: ['error', 'warn'],
        cors: true,
      });

      app.setGlobalPrefix('api');
      app.enableCors({
        origin: [
          'https://easy-fact.vercel.app',
          'http://localhost:3000',
          'http://localhost:5173',
          '*',
        ],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'apikey'],
        credentials: true,
      });

      await app.init();
      isBootstrapping = false;
      return server;
    } catch (err) {
      isBootstrapping = false;
      console.error('❌ NestJS Bootstrap Error:', err);
      throw err;
    }
  })();

  return bootstrapPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await bootstrap();
    server(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Le serveur EasyFact est en cours de démarrage. Réessayez dans 2 secondes.',
    });
  }
}
