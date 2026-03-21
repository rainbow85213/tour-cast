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
    travelPlan: {
      create:   jest.fn(),
      findMany: jest.fn(),
      count:    jest.fn(),
    },
    travelPlanItem: {
      update: jest.fn(),
    },
  },
}));

import prisma from '../prisma';
const mockSchedule     = prisma.schedule     as jest.Mocked<typeof prisma.schedule>;
const mockTravelPlan   = (prisma as any).travelPlan   as jest.Mocked<any>;
const mockTravelPlanItem = (prisma as any).travelPlanItem as jest.Mocked<any>;

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

const PLAN_ITEM = {
  id:          'item_001',
  planId:      'plan_001',
  title:       '경복궁',
  latitude:    37.579,
  longitude:   126.977,
  status:      'pending',
  time:        '10:00',
  scheduledAt: new Date('2026-04-01T10:00:00Z'),
  category:    'attraction',
  description: '오전 관람',
  order:       1,
  createdAt:   new Date(),
};

const TRAVEL_PLAN = {
  id:        'plan_001',
  userId:    'user_abc',
  date:      '2026-04-01',
  title:     '서울 당일 여행',
  sourceText: null,
  createdAt: new Date(),
  items:     [PLAN_ITEM],
};

const PRISMA_NOT_FOUND = Object.assign(new Error('Not found'), { code: 'P2025' });

// ─── POST /api/schedule (TravelPlan 생성) ─────────────────────────────────────
describe('POST /api/schedule', () => {
  const VALID_BODY = {
    userId: 'user_abc',
    date:   '2026-04-01',
    title:  '서울 당일 여행',
    items:  [{
      title:    '경복궁',
      latitude:  37.579,
      longitude: 126.977,
      time:      '10:00',
      category:  'attraction',
      order:     1,
    }],
  };

  it('201 – TravelPlan 생성 성공', async () => {
    mockTravelPlan.create.mockResolvedValue(TRAVEL_PLAN);

    const res = await request(app).post('/api/schedule').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('plan_001');
    expect(res.body.items).toHaveLength(1);
    expect(mockTravelPlan.create).toHaveBeenCalledTimes(1);
  });

  it('400 – userId 누락 시 검증 오류', async () => {
    const res = await request(app).post('/api/schedule').send({ ...VALID_BODY, userId: undefined });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/userId/);
  });

  it('400 – date 형식 오류', async () => {
    const res = await request(app).post('/api/schedule').send({ ...VALID_BODY, date: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('400 – items 누락 시 검증 오류', async () => {
    const { items: _, ...body } = VALID_BODY;
    const res = await request(app).post('/api/schedule').send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/items/);
  });

  it('400 – title이 200자 초과 시 검증 오류', async () => {
    const res = await request(app).post('/api/schedule').send({ ...VALID_BODY, title: 'a'.repeat(201) });

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

// ─── GET /api/schedule/map ────────────────────────────────────────────────────
describe('GET /api/schedule/map', () => {
  it('200 – items 배열 래핑 형식으로 반환', async () => {
    mockTravelPlan.findMany.mockResolvedValue([TRAVEL_PLAN]);

    const res = await request(app).get('/api/schedule/map?userId=user_abc&date=2026-04-01');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].latitude).toBe(37.579);
  });

  it('400 – date 누락 시 오류', async () => {
    const res = await request(app).get('/api/schedule/map?userId=user_abc');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/date/);
  });

  it('400 – userId 누락 시 오류', async () => {
    const res = await request(app).get('/api/schedule/map?date=2026-04-01');

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/schedule/heatmap ────────────────────────────────────────────────
describe('GET /api/schedule/heatmap', () => {
  it('200 – 히트맵 배열 반환', async () => {
    mockTravelPlan.findMany.mockResolvedValue([TRAVEL_PLAN]);

    const res = await request(app).get('/api/schedule/heatmap?userId=user_abc');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('lat');
    expect(res.body[0]).toHaveProperty('lng');
    expect(res.body[0]).toHaveProperty('weight');
  });

  it('400 – userId 누락 시 오류', async () => {
    const res = await request(app).get('/api/schedule/heatmap');

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/schedule/list ───────────────────────────────────────────────────
describe('GET /api/schedule/list', () => {
  it('200 – 여행 플랜 목록 반환', async () => {
    mockTravelPlan.count.mockResolvedValue(1);
    mockTravelPlan.findMany.mockResolvedValue([{ ...TRAVEL_PLAN, items: [{ id: 'item_001' }] }]);

    const res = await request(app).get('/api/schedule/list?userId=user_abc');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('schedules');
    expect(res.body.schedules[0].itemCount).toBe(1);
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('hasMore', false);
  });

  it('400 – userId 누락 시 오류', async () => {
    const res = await request(app).get('/api/schedule/list');

    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/schedule/item/:itemId ─────────────────────────────────────────
describe('PATCH /api/schedule/item/:itemId', () => {
  it('200 – 상태 업데이트 성공', async () => {
    mockTravelPlanItem.update.mockResolvedValue({ id: 'item_001', status: 'completed' });

    const res = await request(app)
      .patch('/api/schedule/item/item_001')
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('item_001');
    expect(res.body.status).toBe('completed');
  });

  it('400 – 잘못된 status 값', async () => {
    const res = await request(app)
      .patch('/api/schedule/item/item_001')
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(400);
  });

  it('404 – 존재하지 않는 itemId', async () => {
    mockTravelPlanItem.update.mockRejectedValue(PRISMA_NOT_FOUND);

    const res = await request(app)
      .patch('/api/schedule/item/nonexistent')
      .send({ status: 'completed' });

    expect(res.status).toBe(404);
  });
});
