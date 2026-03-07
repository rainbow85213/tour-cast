import { Request, Response } from 'express';
import { getNearbyFacilities, FacilityType } from '../services/publicFacilityService';

const VALID_TYPES: FacilityType[] = ['hospital', 'pharmacy', 'all'];
const DEFAULT_RADIUS_M = 1000;
const MAX_RADIUS_M     = 5000;

/**
 * GET /api/public/nearby?lat=37.56&lng=126.97&radius=1000&type=hospital
 * 반경 내 공공시설(병·의원, 약국)을 거리순으로 반환합니다.
 */
export async function getNearby(req: Request, res: Response): Promise<void> {
  const lat    = parseFloat(req.query.lat    as string);
  const lng    = parseFloat(req.query.lng    as string);
  const radius = Math.min(
    MAX_RADIUS_M,
    Math.max(1, parseInt(req.query.radius as string) || DEFAULT_RADIUS_M),
  );
  const type = ((req.query.type as string) ?? 'hospital') as FacilityType;

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ message: 'lat, lng 쿼리 파라미터가 필요합니다.' });
    return;
  }

  if (!VALID_TYPES.includes(type)) {
    res.status(400).json({
      message: `type은 ${VALID_TYPES.join(', ')} 중 하나여야 합니다.`,
    });
    return;
  }

  if (!process.env.PUBLIC_DATA_API_KEY) {
    res.status(503).json({
      message: 'PUBLIC_DATA_API_KEY 미설정 — 공공시설 기능을 사용할 수 없습니다.',
    });
    return;
  }

  try {
    const items = await getNearbyFacilities(lat, lng, radius, type);
    res.json({ total: items.length, lat, lng, radiusM: radius, type, items });
  } catch (err) {
    console.error('[Public] 공공시설 조회 오류:', err);
    res.status(500).json({ message: '공공시설 조회에 실패했습니다.' });
  }
}
