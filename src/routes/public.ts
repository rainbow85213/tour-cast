import { Router } from 'express';
import { getNearby } from '../controllers/publicController';

const router = Router();

/**
 * @openapi
 * /api/public/nearby:
 *   get:
 *     tags: [PublicFacility]
 *     summary: 반경 내 공공시설 조회
 *     description: |
 *       건강보험심사평가원(HIRA) API를 통해 지정 좌표 반경 내 병·의원/약국을 거리순으로 반환합니다.
 *       `PUBLIC_DATA_API_KEY` 환경 변수가 설정되어 있어야 합니다.
 *     parameters:
 *       - name: lat
 *         in: query
 *         required: true
 *         description: 기준 위도
 *         schema: { type: number, example: 37.5662 }
 *       - name: lng
 *         in: query
 *         required: true
 *         description: 기준 경도
 *         schema: { type: number, example: 126.9779 }
 *       - name: radius
 *         in: query
 *         description: 검색 반경 (미터, 기본값 1000, 최대 5000)
 *         schema: { type: integer, default: 1000, minimum: 1, maximum: 5000 }
 *       - name: type
 *         in: query
 *         description: 시설 유형
 *         schema:
 *           type: string
 *           enum: [hospital, pharmacy, all]
 *           default: hospital
 *     responses:
 *       200:
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 3
 *                 lat:
 *                   type: number
 *                   example: 37.5662
 *                 lng:
 *                   type: number
 *                   example: 126.9779
 *                 radiusM:
 *                   type: integer
 *                   example: 1000
 *                 type:
 *                   type: string
 *                   example: hospital
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FacilityItem'
 *       400:
 *         description: 파라미터 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 *       503:
 *         description: PUBLIC_DATA_API_KEY 미설정
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.get('/nearby', getNearby);

export default router;
