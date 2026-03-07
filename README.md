# TourCast API Server

[![CI / CD](https://github.com/rainbow85213/tour-cast/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/rainbow85213/tour-cast/actions/workflows/ci-cd.yml)
[![Tests](https://github.com/rainbow85213/tour-cast/actions/workflows/test.yml/badge.svg)](https://github.com/rainbow85213/tour-cast/actions/workflows/test.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![Last Commit](https://img.shields.io/github/last-commit/rainbow85213/tour-cast)](https://github.com/rainbow85213/tour-cast/commits/master)
[![Top Language](https://img.shields.io/github/languages/top/rainbow85213/tour-cast)](https://github.com/rainbow85213/tour-cast)

Node.js + TypeScript + Express 기반의 관광 정보 REST API 서버입니다.

## 기술 스택

| 분류 | 사용 기술 |
|------|----------|
| 런타임 | Node.js 20 |
| 언어 | TypeScript 5 |
| 프레임워크 | Express 4 |
| ORM | Prisma 7 |
| 검증 | Joi |
| 테스트 | Jest + ts-jest + Supertest |
| DB | PostgreSQL 16 |
| 캐시 | Redis 7 |
| HTTP 클라이언트 | Axios + axios-retry |
| 지오코딩 | 카카오 로컬 API |
| API 문서 | Swagger UI / Scalar |
| 보안 | Helmet + CORS |
| 푸시 알림 | Firebase Admin SDK (FCM) |
| 스케줄러 | node-cron |
| 컨테이너 | Docker / Docker Compose |

## 프로젝트 구조

```
src/
├── index.ts                  # 서버 진입점 (Express 앱, /ping 헬스체크)
├── db.ts                     # pg 커넥션 풀 (레거시, Prisma로 대체)
├── prisma.ts                 # Prisma Client 싱글톤
├── generated/prisma/         # Prisma 자동 생성 클라이언트
├── controllers/
│   ├── spotController.ts          # 반경 내 숙박 검색 (Haversine raw query)
│   ├── festivalController.ts      # 진행중 축제 조회 + 기상청 날씨 병렬 병합
│   ├── campController.ts          # 캠핑장 목록 조회 + isAvailable 시뮬레이션 + bookingUrl 생성
│   ├── scheduleController.ts      # 여행 일정 CRUD + Joi 검증 + 자동 지오코딩
│   ├── notificationController.ts  # FCM 즉시 전송 (POST /api/notification/send)
│   └── geocodeController.ts       # 주소 → 좌표 변환 (GET /api/geocode)
├── routes/
│   ├── touristSpots.ts       # GET /tourist-spots 목록·상세
│   ├── spots.ts              # GET /api/spots/:id/with-accommodations
│   ├── accommodations.ts     # GET /api/accommodations 목록·상세
│   ├── festivals.ts          # GET /api/festivals/active
│   ├── campsites.ts          # GET /api/campsites
│   ├── schedule.ts           # POST/GET/PUT/DELETE /api/schedule
│   ├── notification.ts       # POST /api/notification/send
│   └── geocode.ts            # GET /api/geocode
├── config/
│   └── swagger.ts            # OpenAPI 3.0 스펙 정의 (swagger-jsdoc)
├── services/
│   ├── apiClient.ts              # 공공데이터포털 Axios 인스턴스 (재시도 로직 포함)
│   ├── weatherApiClient.ts       # 기상청 Axios 인스턴스 + baseDateTime 계산
│   ├── redisClient.ts            # ioredis 싱글톤 클라이언트
│   ├── firebase.ts               # Firebase Admin SDK 초기화 (FIREBASE_SERVICE_ACCOUNT_JSON)
│   ├── notificationScheduler.ts  # node-cron 매분 실행 — 30분·1시간 전 알림 자동 발송
│   └── geocodeService.ts         # 카카오 주소/키워드 검색 + Redis 1시간 캐시
├── middlewares/
│   └── cache.ts              # Redis 캐시 미들웨어 팩토리 (X-Cache 헤더 포함)
├── utils/
│   └── weatherGrid.ts        # WGS84 → 기상청 격자 좌표 변환 (LCC DFS)
├── __tests__/
│   └── schedule.test.ts      # Schedule API 테스트 (15개 케이스, Prisma 모킹)
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
| `Schedule` | `schedules` | 여행 일정 (사용자 생성 데이터) |

공공데이터 모델은 `contentId`를 unique key로 사용합니다. `Schedule`은 `cuid()` PK를 사용하며 `userId`, `scheduledAt` 인덱스를 포함합니다. `deviceToken`·`notificationSent` 필드로 FCM 알림 상태를 관리합니다.

## 외부 API

| 클라이언트 | baseURL | 용도 |
|-----------|---------|------|
| `tourApiClient` | `apis.data.go.kr/B551011/KorService2` | 관광지·숙박·축제 |
| `campApiClient` | `apis.data.go.kr/B551011/GoCamping` | 캠핑장 |
| `weatherApiClient` | `apis.data.go.kr/1360000/VilageFcstInfoService_2.0` | 기상청 초단기실황 |
| `geocodeService` | `dapi.kakao.com/v2/local` | 주소·키워드 → 좌표 변환 |

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

### API 문서

서버 실행 후 아래 경로에서 API 문서를 확인할 수 있습니다.

| 경로 | URL | 설명 |
|------|-----|------|
| `GET /api-docs` | http://localhost:3000/api-docs | Swagger UI — 인터랙티브 테스트 |
| `GET /api-reference` | http://localhost:3000/api-reference | Scalar — 읽기 전용 참조 문서 |
| `GET /api-docs/swagger.json` | http://localhost:3000/api-docs/swagger.json | OpenAPI 3.0 JSON 스펙 |

### 헬스체크

| Method | Path | 설명 |
|--------|------|------|
| GET | `/ping` | 서버 상태 확인 (pong) |
| GET | `/api/health` | 서비스 헬스체크 (uptime 포함) |

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

### 캠핑장

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/campsites` | 캠핑장 목록 조회 |

쿼리 파라미터: `page` (기본값 1), `limit` (기본값 20, 최대 100)

#### GET /api/campsites 응답 예시

```json
{
  "total": 500,
  "page": 1,
  "limit": 20,
  "totalPages": 25,
  "items": [
    {
      "id": 1,
      "contentId": "100001",
      "title": "설악산 국립공원 캠핑장",
      "address": "강원도 속초시 ...",
      "mapX": 128.465,
      "mapY": 38.119,
      "induty": "일반야영장",
      "resveUrl": "https://www.reservation.go.kr/...",
      "isAvailable": true,
      "bookingUrl": "https://www.reservation.go.kr/..."
    },
    {
      "id": 2,
      "contentId": "100002",
      "title": "지리산 캠핑장",
      "address": "전라남도 구례군 ...",
      "mapX": 127.593,
      "mapY": 35.337,
      "induty": "카라반",
      "resveUrl": null,
      "isAvailable": false,
      "bookingUrl": "https://search.naver.com/search.naver?query=%EC%A7%80%EB%A6%AC%EC%82%B0+%EC%BA%A0%ED%95%91%EC%9E%A5+%EC%98%88%EC%95%BD"
    }
  ]
}
```

- `isAvailable`: 실시간 예약 가능 여부 시뮬레이션 (요청마다 랜덤 생성)
- `bookingUrl`: DB에 `resveUrl`이 있으면 그대로 사용, 없으면 `캠핑장이름 예약`으로 네이버 검색 URL 자동 생성

### 여행 일정

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/schedule` | 일정 생성 |
| GET | `/api/schedule?userId=` | 일정 목록 조회 |
| GET | `/api/schedule/:id` | 일정 단건 조회 |
| PUT | `/api/schedule/:id` | 일정 수정 |
| DELETE | `/api/schedule/:id` | 일정 삭제 |

쿼리 파라미터: `userId` (필수), `completed` (true/false 필터), `page`, `limit`

#### POST /api/schedule 요청 예시

```json
{
  "userId": "user_abc",
  "title": "경복궁 방문",
  "description": "오전 관람 예정",
  "scheduledAt": "2026-04-01T10:00:00Z",
  "location": {
    "name": "경복궁",
    "address": "서울특별시 종로구 사직로 161",
    "lat": 37.5796,
    "lng": 126.9770,
    "category": "관광지"
  },
  "publicDataRef": "264337"
}
```

- `location.lat` / `location.lng`: **선택 사항** — 미제공 시 `address`로 자동 지오코딩
- `location.category`: 관광지·숙박·축제·캠핑장 등 자유 문자열
- `deviceToken`: FCM 디바이스 토큰 (선택, 설정 시 자동 알림 발송)
- `publicDataRef`: 공공데이터 `contentId` 연결 (선택)
- Joi 검증 적용 — 필수 필드 누락·타입 오류 시 400 반환
- 존재하지 않는 ID 수정·삭제 시 Prisma `P2025` 코드를 감지해 404 반환

### 지오코딩

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/geocode?address=` | 주소·장소명 → 위경도 좌표 변환 |

#### GET /api/geocode 응답 예시

```bash
GET /api/geocode?address=서울시청
```

```json
{
  "lat": 37.5662952,
  "lng": 126.977829,
  "name": "서울특별시청",
  "address": "서울 중구 세종대로 110"
}
```

- 1차: 카카오 주소 검색 API, 결과 없으면 키워드 검색 API로 자동 폴백
- 결과는 Redis에 **1시간** 캐시 (키: `geocode:{query}`)
- `KAKAO_API_KEY` 미설정 시 503, 결과 없음 시 404 반환

### 푸시 알림

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/notification/send` | FCM 푸시 알림 즉시 전송 |

#### POST /api/notification/send 요청 예시

```json
{
  "deviceToken": "fcm-device-token-string",
  "title": "30분 후 일정이 있습니다",
  "body": "경복궁 방문",
  "data": {
    "scheduleId": "clxyz1234",
    "type": "schedule_reminder"
  }
}
```

- `FIREBASE_SERVICE_ACCOUNT_JSON` 미설정 시 503 반환 (graceful 비활성)
- 유효하지 않은 `deviceToken` 시 400 반환
- `data` 필드는 모두 문자열 key-value (선택)

#### 자동 알림 스케줄러

서버 시작 시 node-cron이 **매분** 실행되어 `scheduledAt` 기준 **30분·1시간 전** 일정을 자동 감지해 FCM 알림을 발송합니다.

- `deviceToken`이 있고, `completed: false`이며, 해당 구간 알림 미발송인 일정만 대상
- `notificationSent` 배열에 발송 완료 구간(`30min`, `1hour`)을 기록하여 중복 발송 방지
- Firebase 미초기화 시 스케줄러 자동 비활성

#### Prisma 마이그레이션

```bash
# 개발 환경
npx prisma migrate dev --name add_schedule

# 프로덕션 환경
npx prisma migrate deploy
```

## 보안

### Helmet

모든 응답에 보안 HTTP 헤더를 자동 추가합니다.

| 헤더 | 역할 |
|------|------|
| `X-Content-Type-Options: nosniff` | MIME 타입 스니핑 방지 |
| `X-Frame-Options: SAMEORIGIN` | 클릭재킹 방지 |
| `Strict-Transport-Security` | HTTPS 강제 |
| `X-XSS-Protection: 0` | 구형 브라우저 XSS 필터 비활성 (현대 브라우저 기준) |

> `/api-docs`, `/api-reference` 경로는 Swagger UI 인라인 스크립트 호환을 위해 CSP만 완화 적용합니다.

### CORS

`ALLOWED_ORIGINS` 환경 변수로 허용 도메인을 제어합니다.

```bash
# 개발 — 미설정 시 전체 허용
ALLOWED_ORIGINS=

# 운영 — 쉼표로 구분하여 지정
ALLOWED_ORIGINS=https://example.com,https://www.example.com
```

## 테스트

```bash
npm test              # 전체 테스트 실행
npm run test:watch    # 파일 변경 감지 후 재실행
npm run test:coverage # 커버리지 리포트 생성
```

Jest + ts-jest + Supertest 기반으로 Prisma 클라이언트를 모킹하여 실제 DB 없이 테스트합니다.

| 테스트 파일 | 케이스 수 | 대상 |
|------------|---------|------|
| `src/__tests__/schedule.test.ts` | 15 | POST·GET·PUT·DELETE 정상/오류 케이스 |

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
| `KAKAO_API_KEY` | 카카오 REST API 키 (지오코딩, 미설정 시 지오코딩 기능 비활성) |
| `DB_HOST` | PostgreSQL 호스트 |
| `DB_PORT` | PostgreSQL 포트 |
| `DB_NAME` | DB 이름 |
| `DB_USER` | DB 사용자 |
| `DB_PASSWORD` | DB 비밀번호 |
| `DATABASE_URL` | Prisma 연결 URL |
| `REDIS_URL` | Redis 연결 URL (기본값: `redis://localhost:6379`) |
| `ALLOWED_ORIGINS` | CORS 허용 도메인 (쉼표 구분, 미설정 시 전체 허용) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase 서비스 계정 JSON (FCM 알림, 미설정 시 알림 기능 비활성) |

### Kakao API 키 발급

1. [카카오 개발자 콘솔](https://developers.kakao.com) 접속 → 로그인
2. **내 애플리케이션** → 애플리케이션 추가
3. **앱 설정 → 앱 키**에서 **REST API 키** 복사
4. `.env`에 입력

```bash
KAKAO_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 카카오 로컬 API는 별도 동의 없이 REST API 키만으로 사용 가능합니다.

### Firebase 설정

1. [Firebase 콘솔](https://console.firebase.google.com) → 프로젝트 설정 → 서비스 계정 → **새 비공개 키 생성**
2. 다운로드한 JSON을 한 줄로 직렬화하여 환경 변수에 입력

```bash
# 직렬화 예시
cat service-account.json | jq -c . | pbcopy   # macOS
cat service-account.json | jq -c .             # Linux (출력을 .env에 붙여넣기)

# .env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```
