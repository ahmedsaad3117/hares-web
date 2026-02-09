import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { SanitizePipe } from './common/pipes/sanitize.pipe';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Helmet for basic security headers (HSTS, CSP, XSS protection, etc.)
  app.use(helmet());

  // Enable CORS
  app.enableCors({
    origin: true, // In production, replace with specific domains
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'X-RateLimit-Reset'],
  });

  // Enable global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Use Sanitize Pipe globally to strip scripts/XSS from all inputs
  app.useGlobalPipes(new SanitizePipe());

  // Enable validation pipes with strict settings
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strip properties that are not in the DTO
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
    transform: true, // Transform payloads to DTO instances
  }));

  // Set global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Q1KEY Platform API is running on: http://localhost:${port}`);
}
bootstrap();

