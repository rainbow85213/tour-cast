import { Router, Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import prisma from '../prisma';
import { cacheMiddleware } from '../middlewares/cache';

const router = Router();

const SIX_HOURS = 6 * 60 * 60;
const TWENTY_FOUR_HOURS = 24 * 60 * 60;

const TEN_MINUTES = 10 * 60;

/**
 * @openapi
 * /tourist-spots:
 *   get:
 *     tags: [TouristSpot]
 *     summary: 관광지 목록 조회
 *     description: |
 *       관광지를 페이징하여 반환합니다.
 *       keyword/city 없으면 6시간, 검색 시 10분 동안 Redis에 캐싱됩니다.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: keyword
 *         in: query
 *         required: false
 *         description: title 또는 address 포함 텍스트 검색
 *         schema:
 *           type: string
 *           example: 고양
 *       - name: city
 *         in: query
 *         required: false
 *         description: address 포함 도시명 검색 (keyword가 없을 때만 적용)
 *         schema:
 *           type: string
 *           example: 고양시
 *     responses:
 *       200:
 *         description: 관광지 목록
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
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
 *                         $ref: '#/components/schemas/TouristSpotSummary'
 */
router.get(
  '/',
  cacheMiddleware(
    (req) => {
      const page    = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const keyword = (req.query.keyword as string | undefined)?.trim();
      const city    = (req.query.city    as string | undefined)?.trim();

      if (keyword) return `cache:tourist-spots:search:${keyword}:${page}:${limit}`;
      if (city)    return `cache:tourist-spots:city:${city}:${page}:${limit}`;
      return `cache:tourist-spots:${page}:${limit}`;
    },
    (req) => {
      const keyword = (req.query.keyword as string | undefined)?.trim();
      const city    = (req.query.city    as string | undefined)?.trim();
      return keyword || city ? TEN_MINUTES : SIX_HOURS;
    },
  ),
  async (req: Request, res: Response) => {
    const page    = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip    = (page - 1) * limit;
    const keyword = (req.query.keyword as string | undefined)?.trim();
    const city    = (req.query.city    as string | undefined)?.trim();

    const where: Prisma.TouristSpotWhereInput = {};

    if (keyword) {
      where.OR = [
        { title:   { contains: keyword, mode: 'insensitive' } },
        { address: { contains: keyword, mode: 'insensitive' } },
      ];
    } else if (city) {
      where.address = { contains: city, mode: 'insensitive' };
    }

    const [total, items] = await Promise.all([
      prisma.touristSpot.count({ where }),
      prisma.touristSpot.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          contentId: true,
          title: true,
          address: true,
          mapX: true,
          mapY: true,
          image: true,
        },
      }),
    ]);

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    });
  },
);

/**
 * @openapi
 * /tourist-spots/{id}:
 *   get:
 *     tags: [TouristSpot]
 *     summary: 관광지 단건 조회
 *     description: ID로 관광지 상세 정보를 조회합니다. 결과는 24시간 동안 Redis에 캐싱됩니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 관광지 ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 관광지 상세
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TouristSpotSummary'
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
 */
router.get(
  '/:id',
  cacheMiddleware((req) => `cache:tourist-spot:${req.params.id}`, TWENTY_FOUR_HOURS),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ message: '유효하지 않은 ID입니다.' });
      return;
    }

    const spot = await prisma.touristSpot.findUnique({ where: { id } });

    if (!spot) {
      res.status(404).json({ message: '관광지를 찾을 수 없습니다.' });
      return;
    }

    res.json(spot);
  },
);

export default router;
