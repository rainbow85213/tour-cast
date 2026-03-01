import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

// GET /api/accommodations
router.get('/', async (req: Request, res: Response) => {
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
});

// GET /api/accommodations/:id
router.get('/:id', async (req: Request, res: Response) => {
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
});

export default router;
