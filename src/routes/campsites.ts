import { Router } from 'express';
import { getCampsites } from '../controllers/campController';

const router = Router();

/**
 * @openapi
 * /api/campsites:
 *   get:
 *     tags: [Campsite]
 *     summary: 캠핑장 목록 조회
 *     description: |
 *       캠핑장을 페이징하여 반환합니다.
 *       - `isAvailable`: 예약 가능 여부 — 실제 예약 API 미연동으로 항상 `null` 반환
 *       - `bookingUrl`: DB에 `resveUrl`이 있으면 그대로 사용, 없으면 네이버 검색 URL 자동 생성
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: 캠핑장 목록
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Pagination'
 *                 - type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CampsiteItem'
 */
router.get('/', getCampsites);

export default router;
