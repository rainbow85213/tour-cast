import request from 'supertest';
import express from 'express';
import scheduleRouter from '../routes/schedule';

// ─── Redis 모킹 (CI 환경에서 실제 연결 방지) ──────────────────────────────────
jest.mock('../services/redisClient');

// ─── Prisma 모킹 ──────────────────────────────────────────────────────────────
jest.mock('../prisma', () => ({
  __esModule: true,
  default: {
    schedule: {
      create:     jest.fn(),
      findMany:   jest.fn(),
      count:      jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
      delete:     jest.fn(),
    },
  },
}));

import prisma from '../prisma';
const mockSchedule = prisma.schedule as jest.Mocked<typeof prisma.schedule>;

// ─── 테스트용 Express 앱 ──────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/schedule', scheduleRouter);

// ─── 픽스처 ──────────────────────────────────────────────────────────────────
const LOCATION = { name: '경복궁', address: '서울시 종로구', lat: 37.579, lng: 126.977, category: '관광지' };

const SCHEDULE = {
  id:               'clxyz1234',
  userId:           'user_abc',
  title:            '경복궁 방문',
  description:      '오전 관람',
  scheduledAt:      new Date('2026-04-01T10:00:00Z'),
  location:         LOCATION,
  completed:        false,
  publicDataRef:    null,
  deviceToken:      null,
  notificationSent: [] as string[],
  createdAt:        new Date(),
  updatedAt:        new Date(),
};

const PRISMA_NOT_FOUND = Object.assign(new Error('Not found'), { code: 'P2025' });

// ─── POST /api/schedule ───────────────────────────────────────────────────────
describe('POST /api/schedule', () => {
  it('201 – 유효한 데이터로 일정 생성', async () => {
    mockSchedule.create.mockResolvedValue(SCHEDULE);

    const res = await request(app).post('/api/schedule').send({
      userId: 'user_abc',
      title: '경복궁 방문',
      scheduledAt: '2026-04-01T10:00:00Z',
      location: LOCATION,
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('clxyz1234');
    expect(mockSchedule.create).toHaveBeenCalledTimes(1);
  });

  it('400 – userId 누락 시 검증 오류', async () => {
    const res = await request(app).post('/api/schedule').send({
      title: '경복궁 방문',
      scheduledAt: '2026-04-01T10:00:00Z',
      location: LOCATION,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/userId/);
  });

  it('400 – location 필드 누락 시 검증 오류', async () => {
    const res = await request(app).post('/api/schedule').send({
      userId: 'user_abc',
      title: '경복궁 방문',
      scheduledAt: '2026-04-01T10:00:00Z',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/location/);
  });

  it('400 – scheduledAt 형식 오류', async () => {
    const res = await request(app).post('/api/schedule').send({
      userId: 'user_abc',
      title: '경복궁 방문',
      scheduledAt: 'not-a-date',
      location: LOCATION,
    });

    expect(res.status).toBe(400);
  });

  it('400 – title이 200자 초과 시 검증 오류', async () => {
    const res = await request(app).post('/api/schedule').send({
      userId: 'user_abc',
      title: 'a'.repeat(201),
      scheduledAt: '2026-04-01T10:00:00Z',
      location: LOCATION,
    });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/schedule ────────────────────────────────────────────────────────
describe('GET /api/schedule', () => {
  it('200 – userId로 목록 조회', async () => {
    mockSchedule.count.mockResolvedValue(1);
    mockSchedule.findMany.mockResolvedValue([SCHEDULE]);

    const res = await request(app).get('/api/schedule?userId=user_abc');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(mockSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user_abc' } }),
    );
  });

  it('200 – completed=true 필터 적용', async () => {
    mockSchedule.count.mockResolvedValue(0);
    mockSchedule.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/schedule?userId=user_abc&completed=true');

    expect(res.status).toBe(200);
    expect(mockSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user_abc', completed: true } }),
    );
  });

  it('400 – userId 누락 시 오류', async () => {
    const res = await request(app).get('/api/schedule');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/userId/);
  });
});

// ─── GET /api/schedule/:id ────────────────────────────────────────────────────
describe('GET /api/schedule/:id', () => {
  it('200 – 존재하는 ID 조회', async () => {
    mockSchedule.findUnique.mockResolvedValue(SCHEDULE);

    const res = await request(app).get('/api/schedule/clxyz1234');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('clxyz1234');
  });

  it('404 – 존재하지 않는 ID', async () => {
    mockSchedule.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/schedule/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/찾을 수 없습니다/);
  });
});

// ─── PUT /api/schedule/:id ────────────────────────────────────────────────────
describe('PUT /api/schedule/:id', () => {
  it('200 – 일정 수정 성공', async () => {
    const updated = { ...SCHEDULE, title: '수정된 제목', completed: true };
    mockSchedule.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/schedule/clxyz1234')
      .send({ title: '수정된 제목', completed: true });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('수정된 제목');
    expect(res.body.completed).toBe(true);
  });

  it('400 – 빈 body (min(1) 위반)', async () => {
    const res = await request(app).put('/api/schedule/clxyz1234').send({});

    expect(res.status).toBe(400);
  });

  it('404 – 존재하지 않는 ID 수정 시도', async () => {
    mockSchedule.update.mockRejectedValue(PRISMA_NOT_FOUND);

    const res = await request(app)
      .put('/api/schedule/nonexistent')
      .send({ completed: true });

    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/schedule/:id ─────────────────────────────────────────────────
describe('DELETE /api/schedule/:id', () => {
  it('204 – 삭제 성공', async () => {
    mockSchedule.delete.mockResolvedValue(SCHEDULE);

    const res = await request(app).delete('/api/schedule/clxyz1234');

    expect(res.status).toBe(204);
    expect(mockSchedule.delete).toHaveBeenCalledWith({ where: { id: 'clxyz1234' } });
  });

  it('404 – 존재하지 않는 ID 삭제 시도', async () => {
    mockSchedule.delete.mockRejectedValue(PRISMA_NOT_FOUND);

    const res = await request(app).delete('/api/schedule/nonexistent');

    expect(res.status).toBe(404);
  });
});
