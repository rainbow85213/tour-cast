import { Request, Response } from 'express';
import prisma from '../prisma';
import { latLonToGrid } from '../utils/weatherGrid';
import { weatherApiClient, getBaseDateTime } from '../services/weatherApiClient';
import redis from '../services/redisClient';

// 기상청 하늘상태 (SKY) 코드
const SKY_STATUS: Record<string, string> = {
  '1': '맑음',
  '3': '구름많음',
  '4': '흐림',
};

// 기상청 강수형태 (PTY) 코드
const PTY_STATUS: Record<string, string> = {
  '0': '',
  '1': '비',
  '2': '비/눈',
  '3': '눈',
  '5': '빗방울',
  '6': '빗방울눈날림',
  '7': '눈날림',
};

interface WeatherResult {
  temp: string;
  status: string;
}

async function fetchWeather(nx: number, ny: number): Promise<WeatherResult | null> {
  try {
    const { baseDate, baseTime } = getBaseDateTime();

    const res = await weatherApiClient.get('/getUltraSrtNcst', {
      params: { base_date: baseDate, base_time: baseTime, nx, ny },
    });

    const items: Array<{ category: string; obsrValue: string }> =
      res.data?.response?.body?.items?.item ?? [];

    const get = (category: string) =>
      items.find((i) => i.category === category)?.obsrValue ?? '';

    const t1h = get('T1H'); // 기온
    const pty = get('PTY'); // 강수형태
    const sky = get('SKY'); // 하늘상태 (초단기실황에 없을 수 있음)

    const status = pty && pty !== '0'
      ? (PTY_STATUS[pty] ?? '비/눈')
      : (SKY_STATUS[sky] ?? '맑음');

    return {
      temp: t1h ? `${t1h}°C` : '정보없음',
      status,
    };
  } catch {
    return null;
  }
}

const CACHE_KEY = 'cache:festivals:active';
const CACHE_TTL = 600; // 10분

// GET /api/festivals/active
export async function getActiveFestivals(req: Request, res: Response): Promise<void> {
  // 캐시 조회
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached !== null) {
      res.setHeader('X-Cache', 'HIT');
      res.json(JSON.parse(cached));
      return;
    }
  } catch {
    // fail-open: Redis 오류 시 무시하고 계속 진행
  }

  res.setHeader('X-Cache', 'MISS');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const festivals = await prisma.festival.findMany({
    where: {
      OR: [
        // 진행 중: startDate <= 오늘 <= endDate
        { startDate: { lte: today }, endDate: { gte: today } },
        // 곧 시작: 오늘 이후 7일 이내 시작
        { startDate: { gte: today, lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) } },
      ],
    },
    orderBy: { startDate: 'asc' },
    take: 10,
  });

  // 기상청 API 병렬 호출
  const weatherResults = await Promise.all(
    festivals.map((festival) => {
      if (festival.mapX === null || festival.mapY === null) return null;
      const { x, y } = latLonToGrid(festival.mapY, festival.mapX);
      return fetchWeather(x, y);
    }),
  );

  const result = festivals.map((festival, i) => ({
    ...festival,
    weather: weatherResults[i],
  }));

  const responseBody = {
    total: result.length,
    baseDateTime: getBaseDateTime(),
    items: result,
  };

  // 캐시 저장
  try {
    await redis.set(CACHE_KEY, JSON.stringify(responseBody), 'EX', CACHE_TTL);
  } catch {
    // ignore
  }

  res.json(responseBody);
}
