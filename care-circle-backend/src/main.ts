import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow mobile app to call the API
  app.enableCors({
    origin: true, // later restrict to your app
  });

  await app.listen(process.env.PORT || 3000);
  console.log(`Care Circle backend running on port ${process.env.PORT || 3000}`);
}
bootstrap();