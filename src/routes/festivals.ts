import { Router } from 'express';
import { getActiveFestivals } from '../controllers/festivalController';

const router = Router();

/**
 * @openapi
 * /api/festivals/active:
 *   get:
 *     tags: [Festival]
 *     summary: 진행중·7일내 시작 축제 조회 (날씨 포함)
 *     description: |
 *       오늘 기준으로 진행 중이거나 7일 이내에 시작하는 축제를 최대 10건 반환합니다.
 *       각 축제의 좌표를 기반으로 기상청 초단기실황 API를 `Promise.all`로 병렬 호출하여
 *       현재 날씨를 병합합니다. 결과는 10분 동안 Redis에 캐싱됩니다.
 *     responses:
 *       200:
 *         description: 축제 목록 (날씨 포함)
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
 *                 total:
 *                   type: integer
 *                   example: 3
 *                 baseDateTime:
 *                   type: object
 *                   properties:
 *                     baseDate:
 *                       type: string
 *                       example: '20260301'
 *                     baseTime:
 *                       type: string
 *                       example: '2200'
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       contentId:
 *                         type: string
 *                         example: '3113671'
 *                       title:
 *                         type: string
 *                         example: 가락몰 빵축제
 *                       address:
 *                         type: string
 *                         nullable: true
 *                         example: 서울특별시 송파구
 *                       mapX:
 *                         type: number
 *                         nullable: true
 *                         example: 127.11
 *                       mapY:
 *                         type: number
 *                         nullable: true
 *                         example: 37.496
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       weather:
 *                         $ref: '#/components/schemas/Weather'
 */
router.get('/active', getActiveFestivals);

export default router;
