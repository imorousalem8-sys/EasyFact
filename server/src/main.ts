import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet Security Headers (XSS, Clickjacking, MIME Sniffing protection)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permet l'intégration d'actifs frontend
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Enable Secured CORS for frontend integration
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  // Serve Frontend Static Files (Root & Client folder)
  const rootPath = join(process.cwd(), '..');
  const clientPath = join(process.cwd(), '..', 'client');
  app.use(express.static(rootPath));
  app.use(express.static(clientPath));

  // Global DTO validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global API Prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Serveur NestJS EasyFact Sécurisé sur : http://localhost:${port}`);
  console.log(`📡 API REST sur : http://localhost:${port}/api`);
}

bootstrap();

