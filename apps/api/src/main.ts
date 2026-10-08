import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import session from 'express-session';
import passport from 'passport';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust Proxy (Required for secure cookies behind Nginx/Load Balancer)
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security Headers
  app.use(helmet());

  // Global Prefix
  app.setGlobalPrefix('api');

  // Serve Static Assets (Uploads)
  // Maps /uploads to the actual uploads folder
  // Replaced useStaticAssets with standard express.static to avoid path-to-regexp issues in Express 5
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const isProduction = process.env.NODE_ENV === 'production';

  // 原本是 process.env.SESSION_SECRET || 'super-secret-session-key'。
  // 這個 fallback 字串就寫在公開的原始碼裡 —— 只要正式環境漏設環境變數，
  // 任何人都能偽造 session cookie，而且不會有任何警告。
  // OIDC 的 PKCE code_verifier 就存在這個 session 裡。
  const sessionSecret = process.env.SESSION_SECRET;
  if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error(
      'SESSION_SECRET 未設定或長度不足 32 字元。正式環境不允許使用預設值，請在 apps/api/.env 設定後再啟動。',
    );
  }

  console.log(
    `Starting API in ${process.env.NODE_ENV} mode. Secure cookies: ${isProduction}`,
  );

  // Session Configuration (Required for Passport-SAML)
  app.use(
    session({
      secret: sessionSecret || 'dev-only-insecure-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 3600000,
        secure: isProduction, // Only true in production
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-site redirects in some browsers
      },
    }),
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Enable CORS
  // 開發用的 localhost 來源不該出現在正式環境的允許清單裡
  const allowedOrigins = [
    process.env.CORS_ORIGIN,
    'https://sa-election.ncue.edu.tw',
    ...(isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5190']),
  ].filter((origin): origin is string => !!origin);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger
  //
  // 原本是 SwaggerModule.setup('/', ...) —— 完整的 API 文件（含每個端點、
  // 參數與資料結構）無須驗證就掛在網站根目錄上，等於直接給攻擊者一份地圖。
  // 正式環境關閉；開發環境維持在 /docs 以免佔用根路徑。
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('SAVote API')
      .setDescription('The SAVote API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  const displayUrl = process.env.CORS_ORIGIN || `http://127.0.0.1:8080`;
  console.log(`系統已啟動：${displayUrl}`);
}
bootstrap();
