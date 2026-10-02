import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Reject unknown/invalid fields in request bodies.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = Number(process.env.PORT ?? 3000);
  // Bind to localhost only — the game server and API live on the same box.
  await app.listen(port, '127.0.0.1');
  Logger.log(`RAGE:MP API listening on http://127.0.0.1:${port}`, 'Bootstrap');
}
bootstrap();
