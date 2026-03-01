import { Router, Request, Response } from 'express';
import prisma from '../prisma';
import { cacheMiddleware } from '../middlewares/cache';

const router = Router();

const SIX_HOURS = 6 * 60 * 60;
const TWENTY_FOUR_HOURS = 24 * 60 * 60;

/**
 * @openapi
 * /api/accommodations:
 *   get:
 *     tags: [Accommodation]
 *     summary: 숙박 목록 조회
 *     description: 숙박 시설을 페이징하여 반환합니다. 결과는 6시간 동안 Redis에 캐싱됩니다.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *     responses:
 *       200:
 *         description: 숙박 목록
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
 *                         $ref: '#/components/schemas/AccommodationSummary'
 */
router.get(
  '/',
  cacheMiddleware(
    (req) => {
      const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      return `cache:accommodations:${page}:${limit}`;
    },
    SIX_HOURS,
  ),
  async (req: Request, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip  = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.accommodation.count(),
      prisma.accommodation.findMany({
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
          tel: true,
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
 * /api/accommodations/{id}:
 *   get:
 *     tags: [Accommodation]
 *     summary: 숙박 단건 조회
 *     description: ID로 숙박 시설 상세 정보를 조회합니다. 결과는 24시간 동안 Redis에 캐싱됩니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 숙박 ID
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 숙박 상세
 *         headers:
 *           X-Cache:
 *             schema:
 *               type: string
 *               enum: [HIT, MISS]
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccommodationSummary'
 *       400:
 *         description: 유효하지 않은 ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error400'
 *       404:
 *         description: 숙박 시설 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error404'
 */
router.get(
  '/:id',
  cacheMiddleware((req) => `cache:accommodation:${req.params.id}`, TWENTY_FOUR_HOURS),
  async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ message: '유효하지 않은 ID입니다.' });
      return;
    }

    const accommodation = await prisma.accommodation.findUnique({ where: { id } });

    if (!accommodation) {
      res.status(404).json({ message: '숙박 정보를 찾을 수 없습니다.' });
      return;
    }

    res.json(accommodation);
  },
);

export default router;
