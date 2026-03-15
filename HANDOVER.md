# TourCast — 다음 작업자 인수인계 문서

> 이 문서는 노션에 붙여넣기 용으로 작성되었습니다.
> 최종 업데이트: 2026-03-15

---

## 1. 프로젝트 한 줄 요약

**한국 공공데이터(관광지·숙박·축제·캠핑장) 기반 여행 정보 제공 + 사용자 여행 일정 관리 REST API 서버**

- Node.js 20 + TypeScript 5 + Express 4
- PostgreSQL 16 (Prisma 7 ORM) + Redis 7 캐시
- Firebase FCM 푸시 알림, 카카오 지오코딩, 기상청·HIRA 공공 API 연동

---

## 2. 아키텍처 개요

```
[공공 데이터 원천]
한국관광공사 API ──┐
고캠핑 API        ├──▶ jobs/syncTourData.ts ──▶ PostgreSQL DB
기상청 API        │                              ┌──────────────┐
HIRA 심평원 API   │                              │ tourist_spots│
카카오 로컬 API   ┘                              │ accommodations│
                                                 │ festivals    │
                                                 │ campsites    │
                                                 │ schedules    │
                                                 └──────────────┘
                                                        │
                              Redis (캐시)               │
                              ├── 관광지 목록: 6h         │
                              ├── 관광지 상세: 24h        ▼
                              ├── 숙박: 6h / 24h    Express REST API
                              ├── 축제: 10min            │
                              └── 지오코딩: 1h            ▼
                                                   [클라이언트 앱]
                                                   모바일 / 웹
```

### 서비스 구성 (Docker Compose)

| 서비스 | 이미지 | 포트 |
|-------|--------|------|
| app | Node.js (로컬 빌드) | 3000 |
| postgres | postgres:16-alpine | 3309 |
| redis | redis:7-alpine | 6379 |

---

## 3. 로컬 개발 환경 세팅

### 3-1. 필수 환경변수 설정

```bash
cp .env.example .env
```

`.env`에 아래 항목 입력:

```env
# 서버
PORT=3000
NODE_ENV=development

# DB (Docker 사용 시 그대로)
DB_HOST=localhost
DB_PORT=3309
DB_NAME=tour_cast
DB_USER=tour_cast
DB_PASSWORD=adminpassword
DATABASE_URL="postgresql://tour_cast:adminpassword@localhost:3309/tour_cast?schema=public"

# 캐시
REDIS_URL=redis://localhost:6379

# 공공데이터포털 (관광공사·캠핑·기상청 동일 키 사용 가능)
TOUR_API_KEY=인코딩키
CAMP_API_KEY=인코딩키
WEATHER_API_KEY=인코딩키

# 선택 — 없으면 해당 기능 비활성
KAKAO_API_KEY=카카오REST키
PUBLIC_DATA_API_KEY=공공데이터포털_HIRA키
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
ALLOWED_ORIGINS=   # 빈값이면 전체 허용
```

### 3-2. 실행

```bash
# Docker 전체 실행 (권장)
docker compose up --build

# 로컬 개발 (DB·Redis는 Docker, 앱만 로컬)
npm install
npx prisma migrate dev
npm run dev
```

### 3-3. 데이터 최초 동기화 (DB에 데이터 없을 때 필수)

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

> ⚠️ **이 작업을 하지 않으면 관광지·숙박·축제·캠핑장 API 응답이 전부 빈 배열입니다.**

---

## 4. API 전체 기능 목록 및 테스트

> 아래 curl 명령어는 모두 `http://localhost:3000` 기준입니다.

---

### 4-1. 헬스체크

#### `GET /ping`

```bash
curl http://localhost:3000/ping
```

```json
{ "status": "ok", "message": "pong", "timestamp": "2026-03-15T00:00:00.000Z" }
```

#### `GET /api/health`

```bash
curl http://localhost:3000/api/health
```

```json
{ "status": "ok", "uptime": 3600.42, "timestamp": "2026-03-15T00:00:00.000Z" }
```

---

### 4-2. 관광지

#### `GET /tourist-spots` — 목록 (6시간 캐시)

```bash
curl "http://localhost:3000/tourist-spots?page=1&limit=5"
```

```json
{
  "total": 100,
  "page": 1,
  "limit": 5,
  "totalPages": 20,
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

> `X-Cache: HIT` 헤더 확인으로 캐시 동작 검증 가능

#### `GET /tourist-spots/:id` — 상세 (24시간 캐시)

```bash
curl http://localhost:3000/tourist-spots/1
```

#### `GET /api/spots/:id/with-accommodations` — 반경 5km 숙박 (12시간 캐시)

```bash
curl http://localhost:3000/api/spots/1/with-accommodations
```

```json
{
  "spot": { "id": 1, "title": "가거도", "mapX": 125.126, "mapY": 34.052, "..." },
  "nearbyAccommodations": [
    { "id": 5, "title": "가거도 민박", "distanceKm": 0.39, "..." }
  ]
}
```

> Haversine 공식을 PostgreSQL raw query로 계산 (PostGIS 불필요)

---

### 4-3. 숙박

#### `GET /api/accommodations` — 목록 (6시간 캐시)

```bash
curl "http://localhost:3000/api/accommodations?page=1&limit=5"
```

#### `GET /api/accommodations/:id` — 상세 (24시간 캐시)

```bash
curl http://localhost:3000/api/accommodations/1
```

---

### 4-4. 축제 + 날씨

#### `GET /api/festivals/active` — 진행중·7일내 축제 + 현재 날씨 (10분 캐시)

```bash
curl http://localhost:3000/api/festivals/active
```

```json
{
  "total": 3,
  "baseDateTime": { "baseDate": "20260315", "baseTime": "1400" },
  "items": [
    {
      "id": 1,
      "title": "벚꽃 축제",
      "startDate": "2026-03-14T00:00:00.000Z",
      "endDate": "2026-03-20T00:00:00.000Z",
      "weather": { "temp": "12.3°C", "status": "맑음" }
    }
  ]
}
```

> 기상청 초단기실황 API를 각 축제 좌표로 병렬 호출
> 기상청 API 실패 시 해당 항목 `weather: null` (전체 응답은 정상)

---

### 4-5. 캠핑장

#### `GET /api/campsites` — 목록

```bash
curl "http://localhost:3000/api/campsites?page=1&limit=5"
```

```json
{
  "total": 500,
  "items": [
    {
      "id": 1,
      "title": "설악산 캠핑장",
      "induty": "일반야영장",
      "isAvailable": true,
      "bookingUrl": "https://www.reservation.go.kr/..."
    }
  ]
}
```

> ⚠️ `isAvailable`은 `Math.random() < 0.5` 임시 랜덤값 — 실제 예약 API 미연동
> `resveUrl` 없는 캠핑장은 네이버 검색 URL로 자동 대체

---

### 4-6. 지오코딩

#### `GET /api/geocode` — 주소/장소명 → 좌표 (1시간 캐시)

```bash
curl "http://localhost:3000/api/geocode?address=경복궁"
```

```json
{ "lat": 37.5796, "lng": 126.9770, "name": "경복궁", "address": "서울 종로구 사직로 161" }
```

> 1차: 카카오 주소 검색 → 실패 시 키워드 검색으로 자동 폴백
> `KAKAO_API_KEY` 미설정 시 503

---

### 4-7. 공공시설 (병·의원 / 약국)

#### `GET /api/public/nearby` — 반경 내 공공시설 거리순

```bash
# 병원만
curl "http://localhost:3000/api/public/nearby?lat=37.5662&lng=126.9779&radius=1000&type=hospital"

# 약국만
curl "http://localhost:3000/api/public/nearby?lat=37.5662&lng=126.9779&radius=500&type=pharmacy"

# 병원 + 약국 전체
curl "http://localhost:3000/api/public/nearby?lat=37.5662&lng=126.9779&radius=1000&type=all"
```

```json
{
  "total": 3,
  "lat": 37.5662,
  "lng": 126.9779,
  "radiusM": 1000,
  "type": "hospital",
  "items": [
    { "name": "종로구보건소", "address": "서울 종로구 ...", "lat": 37.570, "lng": 126.981, "distance": 380, "type": "보건기관" }
  ]
}
```

> HIRA API를 `Promise.allSettled`로 병렬 호출 → 하나 실패해도 나머지 결과 반환
> `PUBLIC_DATA_API_KEY` 미설정 시 503

**파라미터 정리:**

| 파라미터 | 필수 | 기본값 | 최대값 | 설명 |
|---------|------|-------|--------|------|
| `lat` | ✓ | — | — | 기준 위도 |
| `lng` | ✓ | — | — | 기준 경도 |
| `radius` | | 1000 | 5000 | 검색 반경 (m) |
| `type` | | hospital | — | `hospital` / `pharmacy` / `all` |

---

### 4-8. 여행 일정 (Schedule CRUD)

#### `POST /api/schedule` — 일정 생성

```bash
# lat/lng 직접 입력
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
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
    }
  }'

# lat/lng 없이 — 자동 지오코딩 + 반경 500m 공공시설 자동 조회
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_abc",
    "title": "경복궁 방문",
    "scheduledAt": "2026-04-01T10:00:00Z",
    "location": {
      "name": "경복궁",
      "address": "경복궁",
      "category": "관광지"
    }
  }'
```

`lat/lng` 미제공 시 응답에 `nearbyFacilities` 자동 포함:

```json
{
  "id": "clxyz1234",
  "userId": "user_abc",
  "title": "경복궁 방문",
  "location": { "name": "경복궁", "lat": 37.5796, "lng": 126.9770, "..." },
  "nearbyFacilities": [
    { "name": "종로구보건소", "distance": 380, "type": "보건기관" }
  ]
}
```

#### `GET /api/schedule?userId=` — 목록 조회

```bash
# 전체 목록
curl "http://localhost:3000/api/schedule?userId=user_abc"

# 미완료만
curl "http://localhost:3000/api/schedule?userId=user_abc&completed=false"

# 페이징
curl "http://localhost:3000/api/schedule?userId=user_abc&page=1&limit=10"
```

#### `GET /api/schedule/:id` — 단건 조회

```bash
curl http://localhost:3000/api/schedule/clxyz1234
```

#### `PUT /api/schedule/:id` — 수정 (부분 업데이트)

```bash
# 완료 처리
curl -X PUT http://localhost:3000/api/schedule/clxyz1234 \
  -H "Content-Type: application/json" \
  -d '{ "completed": true }'

# 제목 + 시간 수정
curl -X PUT http://localhost:3000/api/schedule/clxyz1234 \
  -H "Content-Type: application/json" \
  -d '{ "title": "경복궁 야간 방문", "scheduledAt": "2026-04-01T19:00:00Z" }'
```

#### `DELETE /api/schedule/:id` — 삭제

```bash
curl -X DELETE http://localhost:3000/api/schedule/clxyz1234
# 204 No Content 반환
```

> ⚠️ `userId` 인증 없음 — 누구나 임의 userId로 일정 생성/조회 가능

---

### 4-9. 푸시 알림

#### `POST /api/notification/send` — FCM 즉시 발송

```bash
curl -X POST http://localhost:3000/api/notification/send \
  -H "Content-Type: application/json" \
  -d '{
    "deviceToken": "FCM_DEVICE_TOKEN",
    "title": "테스트 알림",
    "body": "경복궁 방문 30분 전입니다",
    "data": {
      "scheduleId": "clxyz1234",
      "type": "schedule_reminder"
    }
  }'
```

```json
{ "success": true, "messageId": "projects/your-project/messages/abc123" }
```

> `FIREBASE_SERVICE_ACCOUNT_JSON` 미설정 시 503
> 잘못된 토큰 시 400

#### 자동 알림 스케줄러

서버 시작 시 `node-cron`이 **매분** 실행:
- `scheduledAt` 기준 **30분 전 / 1시간 전** 일정 자동 감지
- `deviceToken` 있고 `completed: false`이며 해당 구간 미발송인 것만 대상
- `notificationSent: ["30min", "1hour"]` 배열로 중복 발송 방지

---

### 4-10. API 문서

| URL | 설명 |
|-----|------|
| `http://localhost:3000/api-docs` | Swagger UI (인터랙티브 테스트) |
| `http://localhost:3000/api-reference` | Scalar 읽기 전용 문서 |
| `http://localhost:3000/api-docs/swagger.json` | OpenAPI 3.0 JSON 스펙 |

---

## 5. 테스트 실행

```bash
# 전체 테스트
npm test

# 감시 모드
npm run test:watch

# 커버리지 리포트
npm run test:coverage
```

| 테스트 파일 | 케이스 수 | 대상 |
|------------|---------|------|
| `src/__tests__/schedule.test.ts` | 15 | Schedule API POST·GET·PUT·DELETE 정상/오류 |

> Jest + ts-jest + Supertest 기반
> Prisma 클라이언트 모킹 → 실제 DB 없이 실행 가능

---

## 6. 현재 알려진 이슈 (인수 시 반드시 확인)

| 번호 | 위치 | 심각도 | 내용 |
|------|------|--------|------|
| 1 | `jobs/syncTourData.ts` | 🔴 높음 | DB에 데이터 없음 — sync 잡 수동 실행 필요 (자동 cron 미등록) |
| 2 | `controllers/campController.ts` | 🟡 중간 | 캠핑 예약 가능 여부가 `Math.random()` 임시값 |
| 3 | `controllers/scheduleController.ts` | 🟡 중간 | 사용자 인증 없음 — userId 문자열 자유 입력 |
| 4 | `prisma/schema.prisma` | 🟢 낮음 | `TouristSpot.overview` 필드 존재하나 sync 잡에서 미저장 |
| 5 | 전체 | 🟢 낮음 | TravelPlatform(`https://travel-platform.fly.dev`)과 미연동 |

---

## 7. 다음 작업 우선순위

### 즉시 필요
- [ ] `syncTourData` cron 자동 등록 (매일 새벽 3시 권장)
- [ ] 데이터 첫 동기화 실행 (`Section 3-3` 명령어)

### 단기
- [ ] `userId` 기반 인증 미들웨어 추가 (TravelPlatform JWT 또는 API Key)
- [ ] TravelPlatform(`https://travel-platform.fly.dev`) 연동 설계 및 구현

### 중기
- [ ] 캠핑장 실시간 예약 가능 여부 실연동
- [ ] `overview` 필드 동기화 (관광공사 상세조회 API 추가 호출)
- [ ] fly.io 배포 설정 (`fly.toml`, `Dockerfile` 최적화)

---

## 8. 외부 API 키 정보

| API | 키 이름 | 발급처 |
|-----|---------|--------|
| 한국관광공사 TourAPI | `TOUR_API_KEY` | data.go.kr → B551011/KorService2 신청 |
| 고캠핑 | `CAMP_API_KEY` | data.go.kr → B551011/GoCamping 신청 |
| 기상청 단기예보 | `WEATHER_API_KEY` | data.go.kr → VilageFcstInfoService 신청 |
| 카카오 로컬 | `KAKAO_API_KEY` | developers.kakao.com → REST API 키 |
| HIRA 요양기관 위치정보 | `PUBLIC_DATA_API_KEY` | data.go.kr → B551182/MedGeoInfo 신청 |
| Firebase FCM | `FIREBASE_SERVICE_ACCOUNT_JSON` | console.firebase.google.com → 서비스 계정 |

> 공공데이터포털 API는 모두 같은 키를 공유할 수 있습니다 (TOUR_API_KEY = CAMP_API_KEY = WEATHER_API_KEY = PUBLIC_DATA_API_KEY 동일 키 사용 가능)

---

## 9. 주요 파일 빠른 참조

| 파일 | 역할 |
|------|------|
| `src/index.ts` | Express 앱 + 라우트 등록 + 서버 시작 |
| `prisma/schema.prisma` | DB 모델 5개 정의 |
| `src/jobs/syncTourData.ts` | 공공데이터 → DB 동기화 잡 (수동 실행) |
| `src/controllers/scheduleController.ts` | 일정 CRUD + 자동 지오코딩 + 공공시설 조회 |
| `src/services/notificationScheduler.ts` | FCM 자동 알림 cron (매분) |
| `src/services/geocodeService.ts` | 카카오 지오코딩 + Redis 1시간 캐시 |
| `src/services/publicFacilityService.ts` | HIRA 병원/약국 조회 |
| `src/middlewares/cache.ts` | Redis 캐시 미들웨어 (X-Cache 헤더) |
| `src/utils/haversine.ts` | 거리 계산 (`haversineM`, `haversineKm`) |
| `src/utils/weatherGrid.ts` | WGS84 → 기상청 격자 좌표 변환 (LCC DFS) |
| `docker-compose.yml` | App + PostgreSQL + Redis 컨테이너 구성 |
