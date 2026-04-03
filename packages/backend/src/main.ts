import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { ApiResponseInterceptor } from './common/api-response.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';

process.env.DATABASE_URL ??= 'file:./dev.db';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: ['warn', 'error']
  });
  app.enableShutdownHooks();

  const reflector = app.get(Reflector);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor(reflector));

  const config = new DocumentBuilder()
    .setTitle('Agent Workbench API')
    .setDescription(
      'Static resource management API for the agent configuration workbench.'
    )
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  const host = '0.0.0.0';

  await app.listen(port, host);
  console.info(`backend ready at http://${host}:${port}/api`);
}

void bootstrap().catch((error: unknown) => {
  console.error('Failed to start backend server:', error);
  process.exit(1);
});
