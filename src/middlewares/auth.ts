import { Request, Response, NextFunction } from 'express';

/**
 * SERVICE_API_KEY 기반 Bearer 토큰 인증 미들웨어.
 *
 * - SERVICE_API_KEY 미설정 시: 개발 환경으로 간주하고 경고 로그만 남기고 통과
 * - 설정된 경우: Authorization: Bearer {key} 헤더가 없거나 불일치하면 401 반환
 */
export function requireServiceAuth(req: Request, res: Response, next: NextFunction): void {
  const serviceKey = process.env.SERVICE_API_KEY;

  if (!serviceKey) {
    console.warn('[auth] SERVICE_API_KEY not set — skipping auth check (dev mode)');
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization header missing or malformed' });
    return;
  }

  const token = authHeader.slice(7); // 'Bearer ' 이후
  if (token !== serviceKey) {
    res.status(401).json({ message: 'Invalid service API key' });
    return;
  }

  next();
}
