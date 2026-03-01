# TourCast API Server

Node.js + TypeScript + Express 기반의 관광 정보 REST API 서버입니다.

## 기술 스택

| 분류 | 사용 기술 |
|------|----------|
| 런타임 | Node.js 20 |
| 언어 | TypeScript 5 |
| 프레임워크 | Express 4 |
| ORM | Prisma 7 |
| DB | PostgreSQL 16 |
| 캐시 | Redis 7 |
| HTTP 클라이언트 | Axios + axios-retry |
| 컨테이너 | Docker / Docker Compose |

## 프로젝트 구조

```
src/
├── index.ts                  # 서버 진입점 (Express 앱, /ping 헬스체크)
├── db.ts                     # pg 커넥션 풀 (레거시, Prisma로 대체)
├── prisma.ts                 # Prisma Client 싱글톤
├── generated/prisma/         # Prisma 자동 생성 클라이언트
├── controllers/
│   ├── spotController.ts     # 반경 내 숙박 검색 (Haversine raw query)
│   └── festivalController.ts # 진행중 축제 조회 + 기상청 날씨 병렬 병합
├── routes/
│   ├── touristSpots.ts       # GET /tourist-spots 목록·상세
│   ├── spots.ts              # GET /api/spots/:id/with-accommodations
│   ├── accommodations.ts     # GET /api/accommodations 목록·상세
│   └── festivals.ts          # GET /api/festivals/active
├── services/
│   ├── apiClient.ts          # 공공데이터포털 Axios 인스턴스 (재시도 로직 포함)
│   ├── weatherApiClient.ts   # 기상청 Axios 인스턴스 + baseDateTime 계산
│   └── redisClient.ts        # ioredis 싱글톤 클라이언트
├── middlewares/
│   └── cache.ts              # Redis 캐시 미들웨어 팩토리 (X-Cache 헤더 포함)
├── utils/
│   └── weatherGrid.ts        # WGS84 → 기상청 격자 좌표 변환 (LCC DFS)
└── jobs/
    └── syncTourData.ts       # 관광 데이터 동기화 Job
prisma/
├── schema.prisma             # DB 모델 정의
└── migrations/               # 마이그레이션 히스토리
prisma.config.ts              # Prisma 7 설정 파일 (schema 경로, datasource URL)
```

## 데이터베이스 모델

| 모델 | 테이블 | 설명 |
|------|--------|------|
| `TouristSpot` | `tourist_spots` | 관광지 (contentTypeId=12) |
| `Accommodation` | `accommodations` | 숙박 (contentTypeId=32) |
| `Festival` | `festivals` | 축제 (contentTypeId=15) |
| `Campsite` | `campsites` | 캠핑장 (GoCamping API) |

모든 모델은 `contentId`(공공데이터 ID)를 unique key로 사용하며 `createdAt`, `updatedAt`을 포함합니다.

## 외부 API

| 클라이언트 | baseURL | 용도 |
|-----------|---------|------|
| `tourApiClient` | `apis.data.go.kr/B551011/KorService2` | 관광지·숙박·축제 |
| `campApiClient` | `apis.data.go.kr/B551011/GoCamping` | 캠핑장 |
| `weatherApiClient` | `apis.data.go.kr/1360000/VilageFcstInfoService_2.0` | 기상청 초단기실황 |

- 모든 요청에 `MobileOS=ETC`, `MobileApp=AppTest`, `_type=json` 기본 파라미터 포함
- 네트워크 오류 및 5xx, 429 응답 시 최대 3회 자동 재시도 (1s / 2s / 3s)

## 시작하기

### 환경 변수 설정

```bash
cp .env.example .env
# .env 파일에 API 키와 DB 정보 입력
```

### Docker로 실행 (권장)

```bash
docker compose up --build
```

Docker Compose는 PostgreSQL, Redis, App 컨테이너를 함께 구동합니다. Redis는 `redis:7-alpine` 이미지를 사용하며 앱은 `redis://redis:6379`로 연결됩니다.

### 로컬 개발 서버

```bash
npm install
npm run dev       # ts-node-dev 핫리로드
```

### 데이터 동기화

```bash
npm run build
node -e "
  require('dotenv').config();
  const { syncTouristSpots, syncAccommodations, syncFestivals, syncCampsites } = require('./dist/jobs/syncTourData');
  (async () => {
    await syncTouristSpots();
    await syncAccommodations();
    await syncFestivals();
    await syncCampsites();
    process.exit(0);
  })();
"
```

## API 엔드포인트

### 헬스체크

| Method | Path | 설명 |
|--------|------|------|
| GET | `/ping` | 서버 상태 확인 |

### 관광지

| Method | Path | 설명 |
|--------|------|------|
| GET | `/tourist-spots` | 관광지 목록 조회 |
| GET | `/tourist-spots/:id` | 관광지 단건 조회 |
| GET | `/api/spots/:id/with-accommodations` | 관광지 기준 반경 5km 내 숙박 조회 |

#### GET /tourist-spots 쿼리 파라미터

| 파라미터 | 기본값 | 설명 |
|---------|-------|------|
| `page` | `1` | 페이지 번호 |
| `limit` | `20` | 페이지당 항목 수 (최대 100) |

#### GET /tourist-spots 응답 예시

```json
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5,
  "items": [
    {
      "id": 1,
      "contentId": "127480",
      "title": "가거도",
      "address": "전라남도 신안군 흑산면 가거도길 38-2",
      "mapX": 125.126,
      "mapY": 34.052,
      "image": "https://..."
    }
  ]
}
```

#### GET /api/spots/:id/with-accommodations 응답 예시

```json
{
  "spot": {
    "id": 3,
    "title": "가고파 꼬부랑길 벽화마을",
    "address": "경상남도 창원시 마산합포구 ...",
    "mapX": 128.569,
    "mapY": 35.207
  },
  "nearbyAccommodations": [
    {
      "id": 42,
      "contentId": "2012345",
      "title": "게스트하우스 리좀",
      "address": "경상남도 창원시 ...",
      "mapX": 128.571,
      "mapY": 35.209,
      "tel": "055-000-0000",
      "distanceKm": 0.39
    }
  ]
}
```

> Haversine 공식을 PostgreSQL raw query로 계산하여 DB에서 직접 필터링합니다.

### 숙박

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/accommodations` | 숙박 목록 조회 |
| GET | `/api/accommodations/:id` | 숙박 단건 조회 |

쿼리 파라미터: `page` (기본값 1), `limit` (기본값 20, 최대 100)

### 축제

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/festivals/active` | 진행중·7일내 시작 축제 조회 (날씨 포함) |

#### GET /api/festivals/active 응답 예시

```json
{
  "total": 3,
  "baseDateTime": { "baseDate": "20260301", "baseTime": "2200" },
  "items": [
    {
      "id": 1,
      "contentId": "3113671",
      "title": "가락몰 빵축제",
      "address": "서울특별시 송파구 ...",
      "mapX": 127.110,
      "mapY": 37.496,
      "startDate": "2026-03-01T00:00:00.000Z",
      "endDate": "2026-03-03T00:00:00.000Z",
      "weather": {
        "temp": "5.2°C",
        "status": "맑음"
      }
    }
  ]
}
```

- 오늘 기준 **진행 중**(`startDate ≤ 오늘 ≤ endDate`) 또는 **7일 이내 시작** 축제를 최대 10건 반환
- 기상청 초단기실황 API를 `Promise.all`로 **병렬 호출**
- 기상청 API 실패 시 해당 축제의 `weather` 필드는 `null` 반환 (전체 응답 실패 없음)

## 유틸리티

### 기상청 격자 좌표 변환 (`src/utils/weatherGrid.ts`)

WGS84 위경도를 기상청 단기예보 API에서 사용하는 격자 좌표(X, Y)로 변환합니다.
기상청 LCC DFS(Lambert Conformal Conic) 투영 공식 기반입니다.

```typescript
import { latLonToGrid } from './utils/weatherGrid';

const { x, y } = latLonToGrid(37.5683, 126.9778); // 서울
// → { x: 60, y: 127 }
```

| 도시 | 위도 | 경도 | 격자 X | 격자 Y |
|------|------|------|--------|--------|
| 서울 | 37.5683 | 126.9778 | 60 | 127 |
| 부산 | 35.1796 | 129.0756 | 98 | 76 |
| 대전 | 36.3504 | 127.3845 | 67 | 100 |
| 광주 | 35.1595 | 126.8526 | 58 | 74 |
| 제주 | 33.4890 | 126.4983 | 52 | 38 |

## 환경 변수

| 키 | 설명 |
|----|------|
| `PORT` | 서버 포트 (기본값: 3000) |
| `TOUR_API_KEY` | 한국관광공사 TourAPI 인증키 (Encoding) |
| `CAMP_API_KEY` | 한국관광공사 GoCamping API 인증키 (Encoding) |
| `WEATHER_API_KEY` | 기상청 단기예보 API 인증키 (Encoding) |
| `DB_HOST` | PostgreSQL 호스트 |
| `DB_PORT` | PostgreSQL 포트 |
| `DB_NAME` | DB 이름 |
| `DB_USER` | DB 사용자 |
| `DB_PASSWORD` | DB 비밀번호 |
| `DATABASE_URL` | Prisma 연결 URL |
| `REDIS_URL` | Redis 연결 URL (기본값: `redis://localhost:6379`) |
