import { tourApiClient, campApiClient } from '../services/apiClient';
import prisma from '../prisma';

const AREA_BASED_LIST = '/areaBasedList2';
const NUM_OF_ROWS = 1000;

interface TourItem {
  contentid: string;
  title: string;
  addr1?: string;
  mapx?: string;
  mapy?: string;
  firstimage?: string;
  tel?: string;
  eventstartdate?: string;
  eventenddate?: string;
}

// TODO: overview 동기화
// `areaBasedList2`는 overview 필드를 포함하지 않는다.
// overview를 저장하려면 contentId 1건당 아래 엔드포인트를 별도 호출해야 한다:
//   GET /detailCommon2?contentId={id}&defaultYN=Y&overviewYN=Y
// 관광지 수천 건에 대해 개별 API 호출이 필요하므로 sync 시간이 크게 늘어남.
// 구현 시 선택지:
//   1) 별도 스크립트로 분리 (syncTouristSpotsOverview) + 초기 1회만 실행
//   2) 배치 단위로 rate-limit 걸어서 기존 syncTouristSpots에 통합
// 결정 후 구현 예정 — 현재 overview는 항상 null로 저장됨.

interface CampItem {
  contentId: string;
  facltNm: string;
  addr1?: string;
  mapX?: string;
  mapY?: string;
  induty?: string;
  resveUrl?: string;
}

async function fetchAreaBasedList(contentTypeId: number): Promise<TourItem[]> {
  const all: TourItem[] = [];
  let pageNo = 1;

  while (true) {
    const res = await tourApiClient.get(AREA_BASED_LIST, {
      params: { numOfRows: NUM_OF_ROWS, pageNo, contentTypeId },
    });

    const header = res.data?.response?.header;
    if (header?.resultCode !== '0000') {
      throw new Error(`TourAPI 오류 [${header?.resultCode}]: ${header?.resultMsg}`);
    }

    const body = res.data?.response?.body;
    const items = body?.items?.item;
    const batch: TourItem[] = Array.isArray(items) ? items : [];
    all.push(...batch);

    const totalCount = Number(body?.totalCount ?? 0);
    if (all.length >= totalCount || batch.length < NUM_OF_ROWS) break;
    pageNo++;
  }

  return all;
}

function parseCoord(value?: string): number | null {
  const n = parseFloat(value ?? '');
  return isNaN(n) || n === 0 ? null : n;
}

// 관광지 동기화 (contentTypeId=12)
export async function syncTouristSpots(): Promise<void> {
  console.log('[syncTouristSpots] 시작');

  const items = await fetchAreaBasedList(12);

  let upserted = 0;
  let skipped = 0;

  for (const item of items) {
    const mapX = parseCoord(item.mapx);
    const mapY = parseCoord(item.mapy);

    if (mapX === null || mapY === null) {
      skipped++;
      continue;
    }

    await prisma.touristSpot.upsert({
      where: { contentId: item.contentid },
      update: {
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        image: item.firstimage ?? null,
      },
      create: {
        contentId: item.contentid,
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        image: item.firstimage ?? null,
      },
    });

    upserted++;
  }

  console.log(`[syncTouristSpots] 완료 — upsert: ${upserted}건, 좌표 없어 제외: ${skipped}건`);
}

// 숙박 동기화 (contentTypeId=32)
export async function syncAccommodations(): Promise<void> {
  console.log('[syncAccommodations] 시작');

  const items = await fetchAreaBasedList(32);

  let upserted = 0;
  let skipped = 0;

  for (const item of items) {
    const mapX = parseCoord(item.mapx);
    const mapY = parseCoord(item.mapy);

    if (mapX === null || mapY === null) {
      skipped++;
      continue;
    }

    await prisma.accommodation.upsert({
      where: { contentId: item.contentid },
      update: {
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        tel: item.tel ?? null,
      },
      create: {
        contentId: item.contentid,
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        tel: item.tel ?? null,
      },
    });

    upserted++;
  }

  console.log(`[syncAccommodations] 완료 — upsert: ${upserted}건, 좌표 없어 제외: ${skipped}건`);
}

// 축제 동기화 (searchFestival2, contentTypeId=15)
export async function syncFestivals(): Promise<void> {
  console.log('[syncFestivals] 시작');

  const all: TourItem[] = [];
  let pageNo = 1;

  while (true) {
    const res = await tourApiClient.get('/searchFestival2', {
      params: { numOfRows: NUM_OF_ROWS, pageNo, eventStartDate: '20240101' },
    });

    const header = res.data?.response?.header;
    if (header?.resultCode !== '0000') {
      throw new Error(`TourAPI 오류 [${header?.resultCode}]: ${header?.resultMsg}`);
    }

    const body = res.data?.response?.body;
    const batch: TourItem[] = Array.isArray(body?.items?.item) ? body.items.item : [];
    all.push(...batch);

    const totalCount = Number(body?.totalCount ?? 0);
    if (all.length >= totalCount || batch.length < NUM_OF_ROWS) break;
    pageNo++;
  }

  const items = all;

  let upserted = 0;
  let skipped = 0;

  for (const item of items) {
    const mapX = parseCoord(item.mapx);
    const mapY = parseCoord(item.mapy);

    if (mapX === null || mapY === null) {
      skipped++;
      continue;
    }

    const startDate = item.eventstartdate
      ? new Date(`${item.eventstartdate.slice(0, 4)}-${item.eventstartdate.slice(4, 6)}-${item.eventstartdate.slice(6, 8)}`)
      : null;
    const endDate = item.eventenddate
      ? new Date(`${item.eventenddate.slice(0, 4)}-${item.eventenddate.slice(4, 6)}-${item.eventenddate.slice(6, 8)}`)
      : null;

    await prisma.festival.upsert({
      where: { contentId: item.contentid },
      update: {
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        startDate,
        endDate,
      },
      create: {
        contentId: item.contentid,
        title: item.title,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        startDate,
        endDate,
      },
    });

    upserted++;
  }

  console.log(`[syncFestivals] 완료 — upsert: ${upserted}건, 좌표 없어 제외: ${skipped}건`);
}

// 캠핑장 동기화 (GoCamping)
export async function syncCampsites(): Promise<void> {
  console.log('[syncCampsites] 시작');

  const all: CampItem[] = [];
  let pageNo = 1;

  while (true) {
    const res = await campApiClient.get('/basedList', {
      params: { numOfRows: NUM_OF_ROWS, pageNo },
    });

    const header = res.data?.response?.header;
    if (header?.resultCode !== '0000') {
      throw new Error(`GoCamping API 오류 [${header?.resultCode}]: ${header?.resultMsg}`);
    }

    const body = res.data?.response?.body;
    const batch: CampItem[] = Array.isArray(body?.items?.item) ? body.items.item : [];
    all.push(...batch);

    const totalCount = Number(body?.totalCount ?? 0);
    if (all.length >= totalCount || batch.length < NUM_OF_ROWS) break;
    pageNo++;
  }

  const items = all;

  let upserted = 0;
  let skipped = 0;

  for (const item of items) {
    const mapX = parseCoord(item.mapX);
    const mapY = parseCoord(item.mapY);

    if (mapX === null || mapY === null) {
      skipped++;
      continue;
    }

    await prisma.campsite.upsert({
      where: { contentId: item.contentId },
      update: {
        title: item.facltNm,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        induty: item.induty ?? null,
        resveUrl: item.resveUrl ?? null,
      },
      create: {
        contentId: item.contentId,
        title: item.facltNm,
        address: item.addr1 ?? null,
        mapX,
        mapY,
        induty: item.induty ?? null,
        resveUrl: item.resveUrl ?? null,
      },
    });

    upserted++;
  }

  console.log(`[syncCampsites] 완료 — upsert: ${upserted}건, 좌표 없어 제외: ${skipped}건`);
}
