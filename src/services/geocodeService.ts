import axios from 'axios';
import redis from './redisClient';

const KAKAO_BASE = 'https://dapi.kakao.com/v2/local';
const TTL_SEC    = 60 * 60; // 1시간

export interface GeocodeResult {
  lat:     number;
  lng:     number;
  name:    string;
  address: string;
}

function kakaoHeaders(): Record<string, string> {
  const key = process.env.KAKAO_API_KEY;
  if (!key) throw new Error('KAKAO_API_KEY 환경 변수가 설정되지 않았습니다.');
  return { Authorization: `KakaoAK ${key}` };
}

/**
 * 주소 문자열을 카카오 로컬 API로 지오코딩합니다.
 * 1차: 주소 검색 API (/search/address.json)
 * 2차: 키워드 검색 API (/search/keyword.json) — 주소 검색 결과 없을 때 폴백
 * Redis 캐시 (TTL 1시간) 적용. Redis 장애 시 fail-open.
 */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const cacheKey = `geocode:${query}`;

  // ── 캐시 확인 ──────────────────────────────────────────────────────────────
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as GeocodeResult;
  } catch {
    // Redis 장애 시 무시하고 API 직접 호출
  }

  const headers = kakaoHeaders();
  let result: GeocodeResult | null = null;

  // ── 1차: 주소 검색 ─────────────────────────────────────────────────────────
  const addrRes = await axios.get<KakaoAddressResponse>(
    `${KAKAO_BASE}/search/address.json`,
    { headers, params: { query, size: 1 } },
  );

  const addrDoc = addrRes.data.documents?.[0];
  if (addrDoc) {
    result = {
      lat:     parseFloat(addrDoc.y),
      lng:     parseFloat(addrDoc.x),
      name:    addrDoc.road_address?.building_name || addrDoc.address_name,
      address: addrDoc.road_address?.address_name  || addrDoc.address_name,
    };
  }

  // ── 2차: 키워드 검색 (폴백) ────────────────────────────────────────────────
  if (!result) {
    const kwRes = await axios.get<KakaoKeywordResponse>(
      `${KAKAO_BASE}/search/keyword.json`,
      { headers, params: { query, size: 1 } },
    );

    const kwDoc = kwRes.data.documents?.[0];
    if (kwDoc) {
      result = {
        lat:     parseFloat(kwDoc.y),
        lng:     parseFloat(kwDoc.x),
        name:    kwDoc.place_name,
        address: kwDoc.road_address_name || kwDoc.address_name,
      };
    }
  }

  if (!result) return null;

  // ── 캐시 저장 ──────────────────────────────────────────────────────────────
  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', TTL_SEC);
  } catch {
    // Redis 장애 시 무시
  }

  return result;
}

// ─── Kakao API 응답 타입 ──────────────────────────────────────────────────────

interface KakaoAddressDoc {
  address_name:  string;
  x:             string;
  y:             string;
  road_address?: {
    address_name:  string;
    building_name: string;
  };
}

interface KakaoAddressResponse {
  documents: KakaoAddressDoc[];
}

interface KakaoKeywordDoc {
  place_name:        string;
  address_name:      string;
  road_address_name: string;
  x:                 string;
  y:                 string;
}

interface KakaoKeywordResponse {
  documents: KakaoKeywordDoc[];
}
