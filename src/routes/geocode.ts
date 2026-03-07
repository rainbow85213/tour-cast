import { Router } from 'express';
import { geocodeAddress } from '../controllers/geocodeController';

const router = Router();

/**
 * @openapi
 * /api/geocode:
 *   get:
 *     tags: [Geocode]
 *     summary: 주소/장소명 → 좌표 변환
 *     description: |
 *       카카오 로컬 API를 통해 주소 또는 장소명을 위경도 좌표로 변환합니다.
 *       결과는 Redis에 1시간 동안 캐시됩니다.
 *       1차: 주소 검색 API, 결과 없으면 키워드 검색 API로 폴백합니다.
 *     parameters:
 *       - name: address
 *         in: query
 *         required: true
 *         description: 주소 또는 장소명
 *         schema:
 *           type: string
 *           example: 서울시청
 *     responses:
 *       200:
 *         description: 지오코딩 성공
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *             description: Redis 캐시 히트 여부
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GeocodeResult'
 *       400:
 *         description: address 파라미터 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 *       404:
 *         description: 위치를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error404'
 *       503:
 *         description: KAKAO_API_KEY 미설정
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get('/', geocodeAddress);

export default router;
