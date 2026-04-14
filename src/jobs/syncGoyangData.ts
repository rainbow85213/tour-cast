import { tourApiClient } from '../services/apiClient';
import prisma from '../prisma';

// 한국관광공사 TourAPI areaCode — 경기도: 31
const GYEONGGI_AREA_CODE = 31;
const NUM_OF_ROWS = 1000;

// 고양시를 판별하는 addr1 패턴 (경기도 고양시 덕양구·일산동구·일산서구 모두 포함)
const GOYANG_PATTERN = /고양/;

interface TourItem {
  contentid: string;
  contenttypeid?: string;
  title: string;
  addr1?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
  tel?: string;
  eventstartdate?: string;
  eventenddate?: string;
}

const CATEGORY_MAP: Record<number, string> = {
  12: 'tourist_spot',   // 관광지
  14: 'cultural',       // 문화시설
  15: 'festival',       // 행사/공연/축제
  28: 'sports',         // 레포츠
  38: 'shopping',       // 쇼핑
  39: 'restaurant',     // 음식점
};

function parseCoord(value?: string): number | null {
  const n = parseFloat(value ?? '');
  return isNaN(n) || n === 0 ? null : n;
}

function parseDate(yyyymmdd?: string): Date | null {
  if (!yyyymmdd || yyyymmdd.length < 8) return null;
  const d = new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchGoyangByContentType(contentTypeId: number): Promise<TourItem[]> {
  const all: TourItem[] = [];
  let pageNo = 1;

  while (true) {
    const res = await tourApiClient.get('/areaBasedList2', {
      params: {
        numOfRows: NUM_OF_ROWS,
        pageNo,
        contentTypeId,
        areaCode: GYEONGGI_AREA_CODE,
      },
    });

    const header = res.data?.response?.header;
    if (header?.resultCode !== '0000') {
      throw new Error(`TourAPI 오류 [contentTypeId=${contentTypeId}] [${header?.resultCode}]: ${header?.resultMsg}`);
    }

    const body = res.data?.response?.body;
    const rawItems = body?.items?.item;
    const batch: TourItem[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
    all.push(...batch);

    const totalCount = Number(body?.totalCount ?? 0);
    if (all.length >= totalCount || batch.length < NUM_OF_ROWS) break;
    pageNo++;
  }

  // 고양시 주소만 필터링
  return all.filter((item) => GOYANG_PATTERN.test(item.addr1 ?? ''));
}

async function upsertBatch(items: TourItem[], contentTypeId: number): Promise<{ upserted: number; skipped: number }> {
  let upserted = 0;
  let skipped = 0;
  const category = CATEGORY_MAP[contentTypeId];

  for (const item of items) {
    const mapX = parseCoord(item.mapx);
    const mapY = parseCoord(item.mapy);

    if (mapX === null || mapY === null) {
      skipped++;
      continue;
    }

    const startDate = parseDate(item.eventstartdate);
    const endDate = parseDate(item.eventenddate);

    await prisma.goyangPlace.upsert({
      where: { contentId: item.contentid },
      update: {
        contentTypeId,
        category,
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        image: item.firstimage ?? null,
        tel: item.tel ?? null,
        startDate,
        endDate,
      },
      create: {
        contentId: item.contentid,
        contentTypeId,
        category,
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        image: item.firstimage ?? null,
        tel: item.tel ?? null,
        startDate,
        endDate,
      },
    });

    upserted++;
  }

  return { upserted, skipped };
}

export async function syncGoyangData(): Promise<void> {
  console.log('[syncGoyangData] 고양시 데이터 동기화 시작');
  console.log(`  대상 카테고리: 관광지(12), 문화시설(14), 축제(15), 레포츠(28), 쇼핑(38), 음식점(39)`);

  const contentTypeIds = [12, 14, 15, 28, 38, 39];
  const labels: Record<number, string> = {
    12: '관광지',
    14: '문화시설',
    15: '축제/행사',
    28: '레포츠',
    38: '쇼핑',
    39: '음식점',
  };

  let totalUpserted = 0;
  let totalSkipped = 0;

  for (const typeId of contentTypeIds) {
    console.log(`\n[syncGoyangData] ${labels[typeId]}(${typeId}) 조회 중...`);

    const items = await fetchGoyangByContentType(typeId);
    console.log(`  경기도 조회 후 고양시 필터 결과: ${items.length}건`);

    if (items.length === 0) {
      console.log(`  → 저장할 데이터 없음`);
      continue;
    }

    const { upserted, skipped } = await upsertBatch(items, typeId);
    console.log(`  → upsert: ${upserted}건, 좌표 없어 제외: ${skipped}건`);

    totalUpserted += upserted;
    totalSkipped += skipped;
  }

  // 최종 집계 출력
  const summary = await prisma.goyangPlace.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { category: 'asc' },
  });

  console.log('\n[syncGoyangData] 완료 ─────────────────────────────');
  console.log(`  총 upsert: ${totalUpserted}건 / 좌표 없어 제외: ${totalSkipped}건`);
  console.log('  DB 현황:');
  for (const row of summary) {
    console.log(`    ${row.category.padEnd(12)}: ${row._count.id}건`);
  }
  console.log('─────────────────────────────────────────────────');
}
