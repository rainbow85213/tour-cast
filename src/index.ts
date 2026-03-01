import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './db';
import touristSpotsRouter from './routes/touristSpots';
import spotsRouter from './routes/spots';
import accommodationsRouter from './routes/accommodations';
import festivalsRouter from './routes/festivals';
import campsitesRouter from './routes/campsites';
import redis from './services/redisClient';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/ping', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'pong', timestamp: new Date().toISOString() });
});

app.use('/tourist-spots', touristSpotsRouter);
app.use('/api/spots', spotsRouter);
app.use('/api/accommodations', accommodationsRouter);
app.use('/api/festivals', festivalsRouter);
app.use('/api/campsites', campsitesRouter);

async function shutdown(signal: string) {
  console.log(`[${signal}] Shutting down...`);
  await redis.quit();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function bootstrap() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
