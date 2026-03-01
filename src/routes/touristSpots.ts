import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /tourist-spots
router.get('/', async (req: Request, res: Response) => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip  = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.touristSpot.count(),
    prisma.touristSpot.findMany({
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
});

// GET /tourist-spots/:id
router.get('/:id', async (req: Request, res: Response) => {
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
});

export default router;
