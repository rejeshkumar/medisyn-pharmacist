import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Increase body size limit for image uploads (medicine label scanner)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://medisynweb-production.up.railway.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const config = new DocumentBuilder()
    .setTitle('MediSyn Pharmacist API')
    .setDescription('MediSyn Pharmacy Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🏥 MediSyn API running on http://localhost:${port}`);
  console.log(`📖 API Docs at http://localhost:${port}/api/docs`);
}

bootstrap();

// Sun Mar 22 20:57:27 IST 2026

// rebuild Fri Mar 27 20:37:52 IST 2026
// redeploy Sat Apr 11 13:26:13 IST 2026
// force rebuild Mon Apr 13 23:11:32 IST 2026

// force rebuild Sat May 16 17:43:33 IST 2026
// rebuild Sat May 16 18:45:15 IST 2026
