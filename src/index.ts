import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { apiReference } from '@scalar/express-api-reference';
import { testConnection } from './db';
import touristSpotsRouter from './routes/touristSpots';
import spotsRouter from './routes/spots';
import accommodationsRouter from './routes/accommodations';
import festivalsRouter from './routes/festivals';
import campsitesRouter from './routes/campsites';
import scheduleRouter from './routes/schedule';
import notificationRouter from './routes/notification';
import geocodeRouter from './routes/geocode';
import publicRouter from './routes/public';
import { startNotificationScheduler } from './services/notificationScheduler';
import redis from './services/redisClient';
import { swaggerSpec } from './config/swagger';
import { requireServiceAuth } from './middlewares/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — ALLOWED_ORIGINS 미설정 시 전체 허용 (개발), 설정 시 지정 도메인만 허용 (운영)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ?.split(',')
  .map((o) => o.trim())
  .filter(Boolean) ?? [];

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));

// Helmet — 보안 HTTP 헤더 적용
// Swagger UI가 인라인 스크립트를 사용하므로 /api-docs, /api-reference 경로는 CSP 완화
app.use((req, res, next) => {
  if (req.path.startsWith('/api-docs') || req.path.startsWith('/api-reference')) {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc:  ["'self'", "'unsafe-inline'"],
          styleSrc:   ["'self'", "'unsafe-inline'"],
          imgSrc:     ["'self'", 'data:', 'https:'],
        },
      },
    })(req, res, next);
  }
  return helmet()(req, res, next);
});

app.use(express.json());

/**
 * @openapi
 * /ping:
 *   get:
 *     tags: [Health]
 *     summary: 서버 상태 확인 (ping)
 *     responses:
 *       200:
 *         description: 서버 정상 동작 중
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: pong
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/ping', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'pong', timestamp: new Date().toISOString() });
});

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: 서비스 헬스체크
 *     description: |
 *       서버, DB, Redis 연결 상태를 확인합니다.
 *       모니터링 시스템이나 컨테이너 헬스체크 용도로 사용합니다.
 *     responses:
 *       200:
 *         description: 모든 서비스 정상
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *             description: Redis 캐시 히트 여부
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 uptime:
 *                   type: number
 *                   description: 서버 가동 시간 (초)
 *                   example: 3600.42
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API 문서
app.get('/api-docs/swagger.json', (_req, res) => res.json(swaggerSpec));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'MasilKit API Docs',
  swaggerOptions: { docExpansion: 'list' },
}));

app.use('/api-reference', apiReference({
  spec: { url: '/api-docs/swagger.json' },
  theme: 'purple',
}));

// 공개 조회 엔드포인트 — 인증 불필요
app.use('/tourist-spots', touristSpotsRouter);
app.use('/api/spots', spotsRouter);
app.use('/api/accommodations', accommodationsRouter);
app.use('/api/festivals', festivalsRouter);
app.use('/api/campsites', campsitesRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/public', publicRouter);

// 인증 필요 엔드포인트 — SERVICE_API_KEY Bearer 토큰 검증
app.use('/api/schedule', requireServiceAuth, scheduleRouter);
app.use('/api/notification', requireServiceAuth, notificationRouter);

async function shutdown(signal: string) {
  console.log(`[${signal}] Shutting down...`);
  await redis.quit();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function bootstrap() {
  // 서버를 먼저 시작해 헬스체크가 통과하도록 함
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Swagger UI  → http://localhost:${PORT}/api-docs`);
    console.log(`Scalar Docs → http://localhost:${PORT}/api-reference`);
  });

  // DB 연결 확인 — 실패해도 서버는 유지 (Fly.io cold-start 대응)
  try {
    await testConnection();
  } catch (err) {
    console.error('[DB] 연결 실패 — 서버는 계속 실행됩니다:', err);
  }

  startNotificationScheduler();
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
