import { Request, Response } from 'express';
import prisma from '../prisma';

const RADIUS_KM = 5;

interface NearbyAccommodation {
  id: number;
  contentId: string;
  title: string;
  address: string | null;
  mapX: number;
  mapY: number;
  tel: string | null;
  distanceKm: number;
}

interface NearbyPlaceRow {
  id: number;
  title: string;
  address: string | null;
  mapX: number;
  mapY: number;
  distanceKm: number;
}

// Haversine 공식을 PostgreSQL raw query로 계산
// → DB에서 직접 필터링하므로 데이터가 늘어도 메모리 부담 없음
export async function getSpotWithAccommodations(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    res.status(400).json({ message: '유효하지 않은 ID입니다.' });
    return;
  }

  const spot = await prisma.touristSpot.findUnique({ where: { id } });

  if (!spot) {
    res.status(404).json({ message: '관광지를 찾을 수 없습니다.' });
    return;
  }

  if (spot.mapX === null || spot.mapY === null) {
    res.status(422).json({ message: '해당 관광지에 좌표 정보가 없습니다.' });
    return;
  }

  // Haversine raw query
  // 6371 * acos( cos(radians(기준위도)) * cos(radians(대상위도))
  //            * cos(radians(대상경도) - radians(기준경도))
  //            + sin(radians(기준위도)) * sin(radians(대상위도)) ) <= 반경
  const nearby = await prisma.$queryRaw<NearbyAccommodation[]>`
    SELECT
      id,
      "contentId",
      title,
      address,
      "mapX",
      "mapY",
      tel,
      ROUND(
        (6371 * acos(
          cos(radians(${spot.mapY})) * cos(radians("mapY"))
          * cos(radians("mapX") - radians(${spot.mapX}))
          + sin(radians(${spot.mapY})) * sin(radians("mapY"))
        ))::numeric, 2
      ) AS "distanceKm"
    FROM accommodations
    WHERE "mapX" IS NOT NULL
      AND "mapY" IS NOT NULL
      AND (
        6371 * acos(
          cos(radians(${spot.mapY})) * cos(radians("mapY"))
          * cos(radians("mapX") - radians(${spot.mapX}))
          + sin(radians(${spot.mapY})) * sin(radians("mapY"))
        )
      ) <= ${RADIUS_KM}
    ORDER BY "distanceKm" ASC
  `;

  res.json({
    spot,
    nearbyAccommodations: nearby,
  });
}

export async function getNearbyPlaces(req: Request, res: Response): Promise<void> {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ message: 'lat, lng는 숫자여야 합니다.' });
    return;
  }

  const rawRadius = parseFloat((req.query.radius as string) ?? '3');
  const radius = isNaN(rawRadius) ? 3 : Math.min(rawRadius, 20);
  const rawLimit = parseInt((req.query.limit as string) ?? '10');
  const limit = isNaN(rawLimit) ? 10 : Math.min(rawLimit, 30);
  const type = (req.query.type as string) ?? 'all';

  type NearbyItem = {
    id: number;
    title: string;
    category: 'tourist_spot' | 'accommodation';
    address: string | null;
    lat: number;
    lng: number;
    distanceKm: number;
  };

  const items: NearbyItem[] = [];

  if (type === 'all' || type === 'tourist_spots') {
    const spots = await prisma.$queryRaw<NearbyPlaceRow[]>`
      SELECT
        id, title, address, "mapX", "mapY",
        ROUND(
          (6371 * acos(
            LEAST(1.0,
              cos(radians(${lat})) * cos(radians("mapY"))
              * cos(radians("mapX") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("mapY"))
            )
          ))::numeric, 2
        ) AS "distanceKm"
      FROM tourist_spots
      WHERE "mapX" IS NOT NULL
        AND "mapY" IS NOT NULL
        AND (
          6371 * acos(
            LEAST(1.0,
              cos(radians(${lat})) * cos(radians("mapY"))
              * cos(radians("mapX") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("mapY"))
            )
          )
        ) <= ${radius}
      ORDER BY "distanceKm" ASC
    `;
    for (const row of spots) {
      items.push({
        id: row.id,
        title: row.title,
        category: 'tourist_spot',
        address: row.address,
        lat: row.mapY,
        lng: row.mapX,
        distanceKm: row.distanceKm,
      });
    }
  }

  if (type === 'all' || type === 'accommodations') {
    const accs = await prisma.$queryRaw<NearbyPlaceRow[]>`
      SELECT
        id, title, address, "mapX", "mapY",
        ROUND(
          (6371 * acos(
            LEAST(1.0,
              cos(radians(${lat})) * cos(radians("mapY"))
              * cos(radians("mapX") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("mapY"))
            )
          ))::numeric, 2
        ) AS "distanceKm"
      FROM accommodations
      WHERE "mapX" IS NOT NULL
        AND "mapY" IS NOT NULL
        AND (
          6371 * acos(
            LEAST(1.0,
              cos(radians(${lat})) * cos(radians("mapY"))
              * cos(radians("mapX") - radians(${lng}))
              + sin(radians(${lat})) * sin(radians("mapY"))
            )
          )
        ) <= ${radius}
      ORDER BY "distanceKm" ASC
    `;
    for (const row of accs) {
      items.push({
        id: row.id,
        title: row.title,
        category: 'accommodation',
        address: row.address,
        lat: row.mapY,
        lng: row.mapX,
        distanceKm: row.distanceKm,
      });
    }
  }

  items.sort((a, b) => a.distanceKm - b.distanceKm);
  const limited = items.slice(0, limit);

  res.json({
    items: limited,
    total: limited.length,
    center: { lat, lng },
    radiusKm: radius,
  });
}
