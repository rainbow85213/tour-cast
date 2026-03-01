import { tourApiClient, campApiClient } from '../services/apiClient';
import prisma from '../prisma';

const AREA_BASED_LIST = '/areaBasedList2';
const NUM_OF_ROWS = 100;

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
  const res = await tourApiClient.get(AREA_BASED_LIST, {
    params: { numOfRows: NUM_OF_ROWS, pageNo: 1, contentTypeId },
  });

  const header = res.data?.response?.header;
  if (header?.resultCode !== '0000') {
    throw new Error(`TourAPI 오류 [${header?.resultCode}]: ${header?.resultMsg}`);
  }

  const items = res.data?.response?.body?.items?.item;
  return Array.isArray(items) ? items : [];
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

  const res = await tourApiClient.get('/searchFestival2', {
    params: { numOfRows: NUM_OF_ROWS, pageNo: 1, eventStartDate: '20240101' },
  });

  const header = res.data?.response?.header;
  if (header?.resultCode !== '0000') {
    throw new Error(`TourAPI 오류 [${header?.resultCode}]: ${header?.resultMsg}`);
  }

  const items: TourItem[] = Array.isArray(res.data?.response?.body?.items?.item)
    ? res.data.response.body.items.item
    : [];

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

  const res = await campApiClient.get('/basedList', {
    params: { numOfRows: NUM_OF_ROWS, pageNo: 1 },
  });

  const header = res.data?.response?.header;
  if (header?.resultCode !== '0000') {
    throw new Error(`GoCamping API 오류 [${header?.resultCode}]: ${header?.resultMsg}`);
  }

  const items: CampItem[] = Array.isArray(res.data?.response?.body?.items?.item)
    ? res.data.response.body.items.item
    : [];

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
