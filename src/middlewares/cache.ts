import { Request, Response, NextFunction } from 'express';
import redis from '../services/redisClient';

export function cacheMiddleware(keyFn: (req: Request) => string, ttl: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = keyFn(req);

    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        res.json(JSON.parse(cached));
        return;
      }
    } catch {
      // fail-open: Redis 오류 시 캐시 무시하고 계속 진행
    }

    res.setHeader('X-Cache', 'MISS');

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      try {
        redis.set(key, JSON.stringify(body), 'EX', ttl).catch(() => {});
      } catch {
        // ignore
      }
      return originalJson(body);
    };

    next();
  };
}
