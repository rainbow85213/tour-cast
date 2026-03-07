import { Request, Response } from 'express';
import Joi from 'joi';
import prisma from '../prisma';

// ─── Joi 스키마 ──────────────────────────────────────────────────────────────

const locationSchema = Joi.object({
  name:     Joi.string().required(),
  address:  Joi.string().required(),
  lat:      Joi.number().required(),
  lng:      Joi.number().required(),
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

// ─── POST /api/schedule ───────────────────────────────────────────────────────

export async function createSchedule(req: Request, res: Response): Promise<void> {
  const { error, value } = createSchema.validate(req.body, { abortEarly: false });
  if (error) {
    validationError(res, error.details.map((d) => d.message).join(', '));
    return;
  }

  try {
    const schedule = await prisma.schedule.create({
      data: {
        userId:       value.userId,
        title:        value.title,
        description:  value.description,
        scheduledAt:  value.scheduledAt,
        location:     value.location,
        publicDataRef: value.publicDataRef,
      },
    });
    res.status(201).json(schedule);
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

// ─── Prisma P2025 (레코드 없음) 감지 ──────────────────────────────────────────

function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  );
}
