import { Router } from 'express';
import { getSpotWithAccommodations } from '../controllers/spotController';
import { cacheMiddleware } from '../middlewares/cache';

const router = Router();

const TWELVE_HOURS = 12 * 60 * 60;

/**
 * @openapi
 * /api/spots/{id}/with-accommodations:
 *   get:
 *     tags: [Spot]
 *     summary: 관광지 기준 반경 5km 내 숙박 조회
 *     description: |
 *       Haversine 공식을 PostgreSQL raw query로 계산하여 반경 5km 이내 숙박 시설을
 *       거리 오름차순으로 반환합니다. 결과는 12시간 동안 Redis에 캐싱됩니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 관광지 ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 관광지 정보 및 주변 숙박 목록
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 spot:
 *                   $ref: '#/components/schemas/TouristSpotSummary'
 *                 nearbyAccommodations:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/AccommodationSummary'
 *                       - type: object
 *                         properties:
 *                           distanceKm:
 *                             type: number
 *                             description: 관광지로부터의 거리 (km)
 *                             example: 0.39
 *       400:
 *         description: 유효하지 않은 ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 *       404:
 *         description: 관광지 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error404'
 *       422:
 *         description: 좌표 정보 없음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 해당 관광지에 좌표 정보가 없습니다.
 */
router.get(
  '/:id/with-accommodations',
  cacheMiddleware((req) => `cache:spot:${req.params.id}:with-accommodations`, TWELVE_HOURS),
  getSpotWithAccommodations,
);

export default router;
