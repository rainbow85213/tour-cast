import { Request, Response } from 'express';
import Joi from 'joi';
import prisma from '../prisma';
import { geocode } from '../services/geocodeService';
import { getNearbyFacilities } from '../services/publicFacilityService';

// ─── Joi 스키마 (기존) ────────────────────────────────────────────────────────

const locationSchema = Joi.object({
  name:     Joi.string().required(),
  address:  Joi.string().required(),
  // lat / lng 미제공 시 address로 자동 지오코딩
  lat:      Joi.number(),
  lng:      Joi.number(),
  category: Joi.string().required(),
});

const createSchema = Joi.object({
  userId:       Joi.string().required(),
  title:        Joi.string().min(1).max(200).required(),
  description:  Joi.string().max(1000),
  scheduledAt:  Joi.date().iso().required(),
  location:     locationSchema.required(),
  publicDataRef: Joi.string(),
});

// ─── Joi 스키마 (TravelPlan) ──────────────────────────────────────────────────

const travelPlanItemSchema = Joi.object({
  title:       Joi.string().required(),
  latitude:    Joi.number().required(),
  longitude:   Joi.number().required(),
  status:      Joi.string().valid('completed', 'in_progress', 'pending', 'cancelled').default('pending'),
  time:        Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  scheduledAt: Joi.string().isoDate().allow(null, ''),
  category:    Joi.string().valid('restaurant', 'attraction', 'accommodation', 'transport', 'other').required(),
  description: Joi.string().allow(null, ''),
  order:       Joi.number().integer().required(),
});

const createTravelPlanSchema = Joi.object({
  userId:     Joi.string().required(),
  date:       Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  title:      Joi.string().min(1).max(200).required(),
  sourceText: Joi.string().allow(null, ''),
  items:      Joi.array().items(travelPlanItemSchema).min(1).required(),
});

const updateItemStatusSchema = Joi.object({
  status: Joi.string().valid('completed', 'in_progress', 'pending', 'cancelled').required(),
});

const updateSchema = Joi.object({
  title:        Joi.string().min(1).max(200),
  description:  Joi.string().max(1000).allow(null, ''),
  scheduledAt:  Joi.date().iso(),
  location:     locationSchema,
  completed:    Joi.boolean(),
  publicDataRef: Joi.string().allow(null, ''),
}).min(1);

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function validationError(res: Response, message: string) {
  return res.status(400).json({ message });
}

function notFound(res: Response) {
  return res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
}

// ─── POST /api/schedule (TravelPlan 생성) ─────────────────────────────────────

export async function createTravelPlan(req: Request, res: Response): Promise<void> {
  const { error, value } = createTravelPlanSchema.validate(req.body, { abortEarly: false });
  if (error) {
    validationError(res, error.details.map((d) => d.message).join(', '));
    return;
  }

  try {
    const plan = await prisma.travelPlan.create({
      data: {
        userId:     value.userId,
        date:       value.date,
        title:      value.title,
        sourceText: value.sourceText ?? null,
        items: {
          create: value.items.map((item: any) => ({
            title:       item.title,
            latitude:    item.latitude,
            longitude:   item.longitude,
            status:      item.status ?? 'pending',
            time:        item.time,
            scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
            category:    item.category,
            description: item.description ?? null,
            order:       item.order,
          })),
        },
      },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    res.status(201).json({
      id:    plan.id,
      date:  plan.date,
      title: plan.title,
      items: plan.items,
    });
  } catch (err) {
    console.error('[Schedule] createTravelPlan error:', err);
    res.status(500).json({ message: '일정 저장에 실패했습니다.' });
  }
}

// ─── POST /api/schedule/single (기존 단건 일정 생성, 알림용) ──────────────────

export async function createSchedule(req: Request, res: Response): Promise<void> {
  const { error, value } = createSchema.validate(req.body, { abortEarly: false });
  if (error) {
    validationError(res, error.details.map((d) => d.message).join(', '));
    return;
  }

  // lat / lng 미제공 시 주소로 자동 지오코딩
  const location = { ...value.location };
  let geocodedAuto = false;

  if (location.lat == null || location.lng == null) {
    try {
      const geo = await geocode(location.address);
      if (!geo) {
        res.status(422).json({ message: `"${location.address}" 위치를 찾을 수 없습니다. lat/lng를 직접 입력하거나 주소를 확인하세요.` });
        return;
      }
      location.lat  = geo.lat;
      location.lng  = geo.lng;
      if (!location.name) location.name = geo.name;
      geocodedAuto = true;
    } catch (geoErr) {
      console.error('[Schedule] 지오코딩 오류:', geoErr);
      res.status(502).json({ message: '지오코딩 서비스 오류가 발생했습니다. lat/lng를 직접 입력해 주세요.' });
      return;
    }
  }

  try {
    // DB 저장 + 주변 공공시설 조회(지오코딩 시 자동, fail-open)를 병렬 실행
    const nearbyPromise = (geocodedAuto && process.env.PUBLIC_DATA_API_KEY)
      ? getNearbyFacilities(location.lat!, location.lng!, 500, 'all').catch(() => [])
      : Promise.resolve([]);

    const [schedule, nearbyFacilities] = await Promise.all([
      prisma.schedule.create({
        data: {
          userId:        value.userId,
          title:         value.title,
          description:   value.description,
          scheduledAt:   value.scheduledAt,
          location,
          publicDataRef: value.publicDataRef,
        },
      }),
      nearbyPromise,
    ]);

    res.status(201).json({ ...schedule, nearbyFacilities });
  } catch (err) {
    console.error('[Schedule] create error:', err);
    res.status(500).json({ message: '일정 생성에 실패했습니다.' });
  }
}

// ─── GET /api/schedule ────────────────────────────────────────────────────────

export async function listSchedules(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  if (!userId) {
    validationError(res, 'userId 쿼리 파라미터가 필요합니다.');
    return;
  }

  const page      = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip      = (page - 1) * limit;
  const completed = req.query.completed === 'true'  ? true
                  : req.query.completed === 'false' ? false
                  : undefined;

  try {
    const where = { userId, ...(completed !== undefined && { completed }) };

    const [total, items] = await Promise.all([
      prisma.schedule.count({ where }),
      prisma.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

    res.json({ total, page, limit, totalPages: Math.ceil(total / limit), items });
  } catch (err) {
    console.error('[Schedule] list error:', err);
    res.status(500).json({ message: '일정 목록 조회에 실패했습니다.' });
  }
}

// ─── GET /api/schedule/:id ────────────────────────────────────────────────────

export async function getSchedule(req: Request, res: Response): Promise<void> {
  try {
    const schedule = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!schedule) { notFound(res); return; }
    res.json(schedule);
  } catch (err) {
    console.error('[Schedule] get error:', err);
    res.status(500).json({ message: '일정 조회에 실패했습니다.' });
  }
}

// ─── PUT /api/schedule/:id ────────────────────────────────────────────────────

export async function updateSchedule(req: Request, res: Response): Promise<void> {
  const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
  if (error) {
    validationError(res, error.details.map((d) => d.message).join(', '));
    return;
  }

  try {
    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data:  value,
    });
    res.json(schedule);
  } catch (err: unknown) {
    if (isPrismaNotFound(err)) { notFound(res); return; }
    console.error('[Schedule] update error:', err);
    res.status(500).json({ message: '일정 수정에 실패했습니다.' });
  }
}

// ─── DELETE /api/schedule/:id ─────────────────────────────────────────────────

export async function deleteSchedule(req: Request, res: Response): Promise<void> {
  try {
    await prisma.schedule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err: unknown) {
    if (isPrismaNotFound(err)) { notFound(res); return; }
    console.error('[Schedule] delete error:', err);
    res.status(500).json({ message: '일정 삭제에 실패했습니다.' });
  }
}

// ─── GET /api/schedule/map ────────────────────────────────────────────────────

export async function getMapItems(req: Request, res: Response): Promise<void> {
  const userId  = req.query.userId  as string | undefined;
  const date    = req.query.date    as string | undefined;
  const filters = req.query.filters as string | undefined;

  if (!userId) { validationError(res, 'userId 쿼리 파라미터가 필요합니다.'); return; }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    validationError(res, 'date 쿼리 파라미터가 필요합니다. (형식: YYYY-MM-DD)');
    return;
  }

  const categoryFilter = filters ? filters.split(',').map((f) => f.trim()) : undefined;

  try {
    const plans = await prisma.travelPlan.findMany({
      where: { userId, date },
      include: {
        items: {
          where: categoryFilter ? { category: { in: categoryFilter } } : undefined,
          orderBy: { order: 'asc' },
        },
      },
    });

    const items = plans.flatMap((p) =>
      p.items.map((item) => ({
        id:          item.id,
        title:       item.title,
        latitude:    item.latitude,
        longitude:   item.longitude,
        status:      item.status,
        time:        item.time,
        scheduledAt: item.scheduledAt?.toISOString() ?? null,
        category:    item.category,
        description: item.description,
        order:       item.order,
      })),
    );

    res.json({ items });
  } catch (err) {
    console.error('[Schedule] getMapItems error:', err);
    res.status(500).json({ message: '지도 일정 조회에 실패했습니다.' });
  }
}

// ─── GET /api/schedule/heatmap ────────────────────────────────────────────────

export async function getHeatmap(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  if (!userId) { validationError(res, 'userId 쿼리 파라미터가 필요합니다.'); return; }

  try {
    const plans = await prisma.travelPlan.findMany({
      where: { userId },
      include: { items: true },
    });

    const weightMap = new Map<string, { lat: number; lng: number; weight: number }>();

    for (const plan of plans) {
      for (const item of plan.items) {
        const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
        const existing = weightMap.get(key);
        if (existing) {
          existing.weight += 1;
        } else {
          weightMap.set(key, { lat: item.latitude, lng: item.longitude, weight: 1 });
        }
      }
    }

    res.json(Array.from(weightMap.values()));
  } catch (err) {
    console.error('[Schedule] getHeatmap error:', err);
    res.status(500).json({ message: '히트맵 조회에 실패했습니다.' });
  }
}

// ─── GET /api/schedule/list ───────────────────────────────────────────────────

export async function listTravelPlans(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  if (!userId) { validationError(res, 'userId 쿼리 파라미터가 필요합니다.'); return; }

  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip  = (page - 1) * limit;

  try {
    const [total, plans] = await Promise.all([
      prisma.travelPlan.count({ where: { userId } }),
      prisma.travelPlan.findMany({
        where:   { userId },
        skip,
        take:    limit + 1,
        orderBy: { createdAt: 'desc' },
        include: { items: { select: { id: true } } },
      }),
    ]);

    const hasMore = plans.length > limit;
    const sliced  = hasMore ? plans.slice(0, limit) : plans;

    res.json({
      schedules: sliced.map((p) => ({
        id:        p.id,
        date:      p.date,
        title:     p.title,
        itemCount: p.items.length,
        createdAt: p.createdAt.toISOString(),
      })),
      total,
      hasMore,
    });
  } catch (err) {
    console.error('[Schedule] listTravelPlans error:', err);
    res.status(500).json({ message: '일정 목록 조회에 실패했습니다.' });
  }
}

// ─── PATCH /api/schedule/item/:itemId ─────────────────────────────────────────

export async function updateItemStatus(req: Request, res: Response): Promise<void> {
  const { error, value } = updateItemStatusSchema.validate(req.body, { abortEarly: false });
  if (error) {
    validationError(res, error.details.map((d) => d.message).join(', '));
    return;
  }

  try {
    const item = await prisma.travelPlanItem.update({
      where: { id: req.params.itemId },
      data:  { status: value.status },
    });
    res.json({ id: item.id, status: item.status });
  } catch (err: unknown) {
    if (isPrismaNotFound(err)) { notFound(res); return; }
    console.error('[Schedule] updateItemStatus error:', err);
    res.status(500).json({ message: '상태 업데이트에 실패했습니다.' });
  }
}

// ─── GET /api/schedule/route ──────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getRoute(req: Request, res: Response): Promise<void> {
  const userId = req.query.userId as string | undefined;
  const date   = req.query.date   as string | undefined;

  if (!userId) { validationError(res, 'userId 쿼리 파라미터가 필요합니다.'); return; }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    validationError(res, 'date 쿼리 파라미터가 필요합니다. (형식: YYYY-MM-DD)');
    return;
  }

  try {
    const plans = await prisma.travelPlan.findMany({
      where:   { userId, date },
      include: { items: { orderBy: { order: 'asc' } } },
    });

    const stops = plans.flatMap((p) =>
      p.items.map((item) => ({ lat: item.latitude, lng: item.longitude })),
    );

    if (stops.length === 0) {
      res.json({ coordinates: [], totalDistance: 0, estimatedTime: 0 });
      return;
    }

    let totalDistanceKm = 0;
    for (let i = 1; i < stops.length; i++) {
      totalDistanceKm += haversineKm(
        stops[i - 1].lat, stops[i - 1].lng,
        stops[i].lat,     stops[i].lng,
      );
    }

    res.json({
      coordinates:   stops,
      totalDistance: Math.round(totalDistanceKm * 10) / 10,
      estimatedTime: Math.round((totalDistanceKm / 50) * 60),
    });
  } catch (err) {
    console.error('[Schedule] route error:', err);
    res.status(500).json({ message: '경로 조회에 실패했습니다.' });
  }
}

// ─── Prisma P2025 (레코드 없음) 감지 ──────────────────────────────────────────

function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  );
}
