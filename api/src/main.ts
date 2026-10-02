import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import { AppModule } from './app.module';
import { DbErrorFilter } from './common/db-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Reject unknown/invalid fields in request bodies.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Strip @Exclude-marked fields (e.g. password_hash) from every response.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Never leak raw DB/driver errors (SQL, column names) to clients.
  app.useGlobalFilters(new DbErrorFilter());

  const port = Number(process.env.PORT ?? 3000);
  // Bind to localhost only — the game server and API live on the same box.
  await app.listen(port, '127.0.0.1');
  Logger.log(`RAGE:MP API listening on http://127.0.0.1:${port}`, 'Bootstrap');
}
bootstrap();
