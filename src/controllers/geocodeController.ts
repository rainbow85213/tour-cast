import { Request, Response } from 'express';
import { geocode } from '../services/geocodeService';

/**
 * GET /api/geocode?address=서울시청
 * 주소 또는 장소명을 좌표({lat, lng, name, address})로 변환합니다.
 */
export async function geocodeAddress(req: Request, res: Response): Promise<void> {
  const address = (req.query.address as string | undefined)?.trim();

  if (!address) {
    res.status(400).json({ message: 'address 쿼리 파라미터가 필요합니다.' });
    return;
  }

  if (!process.env.KAKAO_API_KEY) {
    res.status(503).json({ message: 'KAKAO_API_KEY 미설정 — 지오코딩 기능을 사용할 수 없습니다.' });
    return;
  }

  try {
    const result = await geocode(address);

    if (!result) {
      res.status(404).json({ message: `"${address}"에 해당하는 위치를 찾을 수 없습니다.` });
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('[Geocode] 오류:', err);
    res.status(500).json({ message: '지오코딩 요청에 실패했습니다.' });
  }
}
