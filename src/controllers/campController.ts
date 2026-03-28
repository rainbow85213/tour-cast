import { Request, Response } from 'express';
import prisma from '../prisma';

// GET /api/campsites
export async function getCampsites(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip  = (page - 1) * limit;

  const [total, items] = await Promise.all([
    prisma.campsite.count(),
    prisma.campsite.findMany({
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
        induty: true,
        resveUrl: true,
      },
    }),
  ]);

  const enriched = items.map((camp) => ({
    ...camp,
    isAvailable: null,
    bookingUrl: camp.resveUrl
      ? camp.resveUrl
      : `https://search.naver.com/search.naver?query=${encodeURIComponent(camp.title + ' 예약')}`,
  }));

  res.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    items: enriched,
  });
}
