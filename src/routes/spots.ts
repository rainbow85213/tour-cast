import { Router } from 'express';
import { getSpotWithAccommodations, getNearbyPlaces } from '../controllers/spotController';
import { cacheMiddleware } from '../middlewares/cache';

const router = Router();

const ONE_HOUR = 60 * 60;
const TWELVE_HOURS = 12 * 60 * 60;

/**
 * @openapi
 * /api/spots/nearby:
 *   get:
 *     tags: [Spot]
 *     summary: 좌표 기반 근처 관광지·숙박 검색
 *     description: |
 *       위도/경도를 기준으로 반경 내 관광지와 숙박 시설을 거리 오름차순으로 반환합니다.
 *       Haversine 공식을 PostgreSQL raw query로 계산하며, 결과는 1시간 동안 Redis에 캐싱됩니다.
 *       lat/lng는 소수점 4자리로 반올림하여 캐시 키를 생성합니다.
 *     parameters:
 *       - name: lat
 *         in: query
 *         required: true
 *         description: 기준 위도
 *         schema:
 *           type: number
 *           example: 37.5665
 *       - name: lng
 *         in: query
 *         required: true
 *         description: 기준 경도
 *         schema:
 *           type: number
 *           example: 126.9780
 *       - name: radius
 *         in: query
 *         required: false
 *         description: 검색 반경 (km, 기본값 3, 최대 20)
 *         schema:
 *           type: number
 *           default: 3
 *           maximum: 20
 *       - name: limit
 *         in: query
 *         required: false
 *         description: 반환 개수 (기본값 10, 최대 30)
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 30
 *       - name: type
 *         in: query
 *         required: false
 *         description: 검색 대상 종류
 *         schema:
 *           type: string
 *           enum: [all, tourist_spots, accommodations]
 *           default: all
 *     responses:
 *       200:
 *         description: 근처 장소 목록
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
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       category:
 *                         type: string
 *                         enum: [tourist_spot, accommodation]
 *                       address:
 *                         type: string
 *                         nullable: true
 *                       lat:
 *                         type: number
 *                       lng:
 *                         type: number
 *                       distanceKm:
 *                         type: number
 *                         example: 0.87
 *                 total:
 *                   type: integer
 *                 center:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                     lng:
 *                       type: number
 *                 radiusKm:
 *                   type: number
 *       400:
 *         description: lat 또는 lng가 숫자가 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 */
router.get(
  '/nearby',
  cacheMiddleware((req) => {
    const lat = parseFloat(req.query.lat as string).toFixed(4);
    const lng = parseFloat(req.query.lng as string).toFixed(4);
    const radius = req.query.radius ?? '3';
    const limit = req.query.limit ?? '10';
    const type = req.query.type ?? 'all';
    return `cache:spots:nearby:lat:${lat}:lng:${lng}:radius:${radius}:limit:${limit}:${type}`;
  }, ONE_HOUR),
  getNearbyPlaces,
);

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
