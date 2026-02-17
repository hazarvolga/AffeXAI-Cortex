import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ResponseInterceptor } from './common/interceptors';
import { GlobalExceptionFilter } from './common/filters';
import { json, urlencoded } from 'express';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

    // Serve static files from uploads directory
    // Use process.cwd() for Docker compatibility - uploads directory is at project root
    app.useStaticAssets(join(process.cwd(), 'uploads'), {
      prefix: '/uploads/',
    });

    // Get configuration service
    const configService = app.get(ConfigService);

    // Debug Configuration
    console.log('🔧 Initializing backend with config:');
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   - REDIS_HOST: ${configService.get('REDIS_HOST', 'N/A')}`);
    console.log(`   - DB_HOST: ${configService.get('DB_HOST', 'N/A')}`);
    console.log(`   - PORT: ${configService.get('PORT', 'N/A')}`);

    // Set global API prefix
    app.setGlobalPrefix('api');

    // Increase body parser limit for large SQL imports (temporary endpoint)
    app.use(json({ limit: '10mb' }));
    app.use(urlencoded({ extended: true, limit: '10mb' }));

    // Security with Helmet
    app.use(helmet());

    // Response compression
    app.use(compression());

    // CORS configuration (environment-based)
    const allowedOrigins = configService
      .get<string>('CORS_ORIGINS', 'http://localhost:9002')
      .split(',')
      .map(origin => origin.trim());

    console.log('🌐 CORS enabled for origins:', allowedOrigins);

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // In development, allow all localhost/127.0.0.1 origins
        if (process.env.NODE_ENV === 'development') {
          if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
          }
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-start-time', 'x-tenant-id', 'x-api-key'],
      exposedHeaders: ['Authorization'],
      maxAge: 86400, // 24 hours
    });

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    // Global ClassSerializerInterceptor for @Exclude() decorators
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

    // Global response interceptor (wraps all responses in ApiResponse format)
    app.useGlobalInterceptors(new ResponseInterceptor());

    // Global exception filter (formats all errors in ApiResponse format)
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Swagger setup
    const config = new DocumentBuilder()
      .setTitle('Aluplan API')
      .setDescription('API documentation for Aluplan application')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    // Get port from environment variables or default to 9005
    const port = configService.get<number>('PORT', 9005);

    // Start the application
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://localhost:${port}`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM signal received: closing HTTP server');
      await app.close();
      console.log('HTTP server closed');
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT signal received: closing HTTP server');
      await app.close();
      console.log('HTTP server closed');
    });
  } catch (error) {
    console.error('Error starting the application:', error);
    process.exit(1);
  }
}
bootstrap();