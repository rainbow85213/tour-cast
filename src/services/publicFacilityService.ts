import axios from 'axios';
import { haversineM } from '../utils/haversine';

export type FacilityType = 'hospital' | 'pharmacy' | 'all';

export interface FacilityItem {
  name:     string;
  address:  string;
  lat:      number;
  lng:      number;
  distance: number; // 미터(m)
  type:     string;
}

// 건강보험심사평가원 MedGeoInfo API
const HIRA_BASE = 'https://apis.data.go.kr/B551182/MedGeoInfo';

function getApiKey(): string {
  const key = process.env.PUBLIC_DATA_API_KEY;
  if (!key) throw new Error('PUBLIC_DATA_API_KEY 환경 변수가 설정되지 않았습니다.');
  return key;
}

// ─── HIRA 응답 아이템 타입 ────────────────────────────────────────────────────

interface HiraItem {
  yadmNm:   string;
  addr:     string;
  wgs84Lat: string;
  wgs84Lon: string;
  clCdNm?:  string;
  telno?:   string;
}

function normalizeItems(
  raw: unknown,
  originLat: number,
  originLng: number,
  defaultType: string,
): FacilityItem[] {
  if (!raw) return [];
  const list: HiraItem[] = Array.isArray(raw) ? raw : [raw as HiraItem];
  return list
    .filter((item) => item.wgs84Lat && item.wgs84Lon)
    .map((item) => {
      const lat = parseFloat(item.wgs84Lat);
      const lng = parseFloat(item.wgs84Lon);
      return {
        name:     item.yadmNm   ?? '',
        address:  item.addr     ?? '',
        lat,
        lng,
        distance: Math.round(haversineM(originLat, originLng, lat, lng)),
        type:     item.clCdNm  ?? defaultType,
      };
    });
}

// ─── 병·의원 조회 ─────────────────────────────────────────────────────────────

async function fetchHospitals(
  lat: number, lng: number, distKm: number,
): Promise<FacilityItem[]> {
  const res = await axios.get(`${HIRA_BASE}/getMedBasisList`, {
    params: {
      ServiceKey: getApiKey(),
      WGS84_LAT:  lat,
      WGS84_LON:  lng,
      DIST:       Math.max(1, Math.ceil(distKm)),
      pageNo:     1,
      numOfRows:  100,
      _type:      'json',
    },
  });
  const raw = res.data?.response?.body?.items?.item;
  return normalizeItems(raw, lat, lng, '병·의원');
}

// ─── 약국 조회 ────────────────────────────────────────────────────────────────

async function fetchPharmacies(
  lat: number, lng: number, distKm: number,
): Promise<FacilityItem[]> {
  const res = await axios.get(`${HIRA_BASE}/getMedBasisList`, {
    params: {
      ServiceKey: getApiKey(),
      WGS84_LAT:  lat,
      WGS84_LON:  lng,
      DIST:       Math.max(1, Math.ceil(distKm)),
      clCd:       'P', // 약국 분류 코드
      pageNo:     1,
      numOfRows:  100,
      _type:      'json',
    },
  });
  const raw = res.data?.response?.body?.items?.item;
  return normalizeItems(raw, lat, lng, '약국');
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 반경 내 공공시설(병·의원/약국)을 거리순으로 반환합니다.
 * HIRA의 DIST 파라미터는 km 단위 정수이므로, radiusM보다 크게 요청 후 로컬에서 정밀 필터링합니다.
 *
 * @param lat      기준 위도
 * @param lng      기준 경도
 * @param radiusM  검색 반경 (미터, 최대 5000)
 * @param type     시설 유형: hospital | pharmacy | all
 */
export async function getNearbyFacilities(
  lat: number,
  lng: number,
  radiusM: number,
  type: FacilityType = 'hospital',
): Promise<FacilityItem[]> {
  const distKm = radiusM / 1000;

  let items: FacilityItem[];

  if (type === 'all') {
    const [hospitals, pharmacies] = await Promise.allSettled([
      fetchHospitals(lat, lng, distKm),
      fetchPharmacies(lat, lng, distKm),
    ]);
    items = [
      ...(hospitals.status  === 'fulfilled' ? hospitals.value  : []),
      ...(pharmacies.status === 'fulfilled' ? pharmacies.value : []),
    ];
  } else if (type === 'pharmacy') {
    items = await fetchPharmacies(lat, lng, distKm);
  } else {
    items = await fetchHospitals(lat, lng, distKm);
  }

  // 정밀 반경 필터 + 거리순 정렬
  return items
    .filter((f) => f.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance);
}
