# TourCast — CLAUDE.md

## 1. Ecosystem Context

TourCast는 **Travel-Ecosystem-Hub** 내 데이터 공급 서비스입니다.

```
TravelPlatform (https://travel-platform.fly.dev)
        │
        │  REST HTTP 호출
        ▼
   TourCast (https://tour-cast.fly.dev)
        │
        ├── 한국관광공사 TourAPI
        ├── 고캠핑 API
        ├── 기상청 API
        ├── HIRA 심평원 API
        └── 카카오 로컬 API
```

- **역할:** TravelPlatform의 요청을 받아 관광지·숙박·축제·캠핑장 데이터 공급
- **외부 API 연동 레이어:** 공공데이터포털 및 카카오 API를 중간에서 통합·캐싱하여 제공
- **현재 상태:** TravelPlatform과 실제 연동은 미구현 (HANDOVER.md 이슈 #5 참조)

---

## 2. Tech Stack

| 항목 | 버전 / 라이브러리 |
|------|----------------|
| **Node.js** | 20.x |
| **TypeScript** | 5.5.x |
| **프레임워크** | Express 4.19 |
| **ORM** | Prisma 7 (`@prisma/adapter-pg` 드라이버 사용) |
| **DB** | PostgreSQL 16 |
| **캐시** | Redis 7 (ioredis 5) |
| **푸시 알림** | Firebase Admin SDK 13 (FCM) |
| **HTTP 클라이언트** | axios + axios-retry |
| **스케줄러** | node-cron 4 |
| **유효성 검증** | joi 18 |
| **보안** | helmet 8, cors 2 |
| **API 문서** | swagger-jsdoc + swagger-ui-express, @scalar/express-api-reference |
| **테스트** | Jest 30 + ts-jest + supertest |
| **빌드** | tsc (target: ES2020, outDir: dist/) |

---

## 3. Data Models

`prisma/schema.prisma` 기반 — PostgreSQL 테이블 5개 + 관계 1개

```
TouristSpot        (tourist_spots)
  id, contentId*, title, address, mapX, mapY, image, overview

Accommodation      (accommodations)
  id, contentId*, title, address, mapX, mapY, tel

Festival           (festivals)
  id, contentId*, title, address, mapX, mapY, startDate, endDate

Campsite           (campsites)
  id, contentId*, title, address, mapX, mapY, induty, resveUrl

Schedule           (schedules)
  id(cuid), userId, title, description, scheduledAt, location(Json),
  completed, publicDataRef, deviceToken, notificationSent[]

TravelPlan         (travel_plans)           ←─┐  1:N
  id(cuid), userId, date(YYYY-MM-DD), title, sourceText    │
                                                            │
TravelPlanItem     (travel_plan_items)      ───┘
  id(cuid), planId→TravelPlan, title, latitude, longitude,
  status, time, scheduledAt, category, description, order
```

- `contentId`는 공공데이터 원천 ID (UNIQUE 제약)
- `location` 필드: `{ name, address, lat, lng, category }` JSON 구조
- Prisma 클라이언트는 `src/generated/prisma/` 에 생성됨 (`.gitignore` 제외)

---

## 4. API Endpoints

`src/index.ts` 기반 실제 라우트 목록

### 헬스체크
| Method | Path | 설명 |
|--------|------|------|
| GET | `/ping` | 서버 상태 확인 |
| GET | `/api/health` | 서버 헬스체크 (Fly.io 헬스체크 대상) |

### 관광지
| Method | Path | 캐시 | 설명 |
|--------|------|------|------|
| GET | `/tourist-spots` | 6h | 목록 (page, limit) |
| GET | `/tourist-spots/:id` | 24h | 상세 |
| GET | `/api/spots/:id/with-accommodations` | 12h | 관광지 + 반경 5km 숙박 (Haversine) |

### 숙박
| Method | Path | 캐시 | 설명 |
|--------|------|------|------|
| GET | `/api/accommodations` | 6h | 목록 |
| GET | `/api/accommodations/:id` | 24h | 상세 |

### 축제
| Method | Path | 캐시 | 설명 |
|--------|------|------|------|
| GET | `/api/festivals/active` | 10min | 진행중·7일내 축제 + 기상청 날씨 병렬 조회 |

### 캠핑장
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/campsites` | 목록 (page, limit) |
| GET | `/api/campsites/:id` | 상세 |

### 여행 일정 (Schedule CRUD)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/schedule` | 생성 (lat/lng 없으면 자동 지오코딩 + 공공시설 조회) |
| GET | `/api/schedule` | 목록 (userId 필수, completed·page·limit 옵션) |
| GET | `/api/schedule/:id` | 단건 조회 |
| PUT | `/api/schedule/:id` | 부분 수정 |
| DELETE | `/api/schedule/:id` | 삭제 (204) |
| GET | `/api/schedule/map` | 지도용 일정 조회 (`/route` 별칭) |

### 기타
| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/geocode` | 주소/장소명 → 좌표 (카카오, 1h 캐시) |
| GET | `/api/public/nearby` | 반경 내 병원·약국 (HIRA API) |
| POST | `/api/notification/send` | FCM 즉시 푸시 발송 |

### API 문서
| URL | 설명 |
|-----|------|
| `/api-docs` | Swagger UI |
| `/api-reference` | Scalar 문서 |
| `/api-docs/swagger.json` | OpenAPI 3.0 JSON |

---

## 5. Environment Variables

`.env.example` 기반. **굵게** 표시된 항목은 TravelPlatform에서 이 서비스 호출 시 필수.

```env
# 서버
PORT=3000
NODE_ENV=development

# 외부 API 키 (공공데이터포털에서 동일한 키 공유 가능)
TOUR_API_KEY=       # 한국관광공사 TourAPI
CAMP_API_KEY=       # 고캠핑 API
WEATHER_API_KEY=    # 기상청 단기예보
KAKAO_API_KEY=      # 카카오 로컬 REST API (지오코딩)
PUBLIC_DATA_API_KEY= # HIRA 요양기관 위치정보 (병원·약국)

# DB
DB_HOST=localhost
DB_PORT=3309
DB_NAME=tour_cast
DB_USER=tour_cast
DB_PASSWORD=
DATABASE_URL="postgresql://tour_cast:password@localhost:3309/tour_cast?schema=public"

# 캐시
REDIS_URL=redis://localhost:6379

# 서비스간 인증 키 (TravelPlatform → TourCast 호출 시 Authorization: Bearer {key})
# 미설정 시 개발 모드로 간주하여 인증 없이 통과
SERVICE_API_KEY=

# CORS — 쉼표 구분, 미설정 시 전체 허용
# TravelPlatform 운영 URL을 여기에 등록해야 함
ALLOWED_ORIGINS=https://travel-platform.fly.dev

# Firebase FCM (JSON을 한 줄로 직렬화: cat service-account.json | jq -c .)
FIREBASE_SERVICE_ACCOUNT_JSON=
```

> `SERVICE_API_KEY` 미설정 → 개발 모드 (경고 로그, 인증 통과)
> `KAKAO_API_KEY` 미설정 → `/api/geocode` 503
> `PUBLIC_DATA_API_KEY` 미설정 → `/api/public/nearby` 503
> `FIREBASE_SERVICE_ACCOUNT_JSON` 미설정 → `/api/notification/send` 503

---

## 6. Cross-Repo Rules

TravelPlatform이 TourCast를 호출하는 방식 및 규칙:

### 호출 방식
```
# 운영
GET https://tour-cast.fly.dev/api/spots/123/with-accommodations

# 개발 (로컬)
GET http://localhost:3000/api/spots/123/with-accommodations
```

### 인증 처리
- **`Authorization: Bearer {SERVICE_API_KEY}` 헤더 필수** (보호 엔드포인트 대상)
- `SERVICE_API_KEY` 미설정 시 개발 모드로 간주 — 경고 로그만 남기고 인증 통과
- 미들웨어: `src/middlewares/auth.ts` → `requireServiceAuth`
- **보호 대상:** `/api/schedule/*`, `/api/notification/*`
- **인증 불필요:** `/tourist-spots`, `/api/spots`, `/api/accommodations`, `/api/festivals`, `/api/campsites`, `/api/geocode`, `/api/public`
- `userId`는 여전히 문자열로 요청 바디·쿼리에서 전달 (Bearer 토큰과 별개)

### CORS 설정
- `ALLOWED_ORIGINS`에 TravelPlatform 도메인 등록 필수
- 미등록 시 브라우저 직접 호출은 차단되나 서버간 호출은 영향 없음

### 캐시 확인
- 응답 헤더 `X-Cache: HIT | MISS`로 Redis 캐시 상태 확인 가능

---

## 7. Build & Deploy

### 빌드
```bash
npm run build   # tsc → dist/ 생성
npm start       # node dist/index.js
```

빌드 결과물 구조:
```
dist/
├── index.js          # 엔트리포인트
├── controllers/
├── routes/
├── services/
├── jobs/
│   └── syncTourData.js   # 공공데이터 동기화 (수동 실행)
└── utils/
```

> `dist/`는 `.gitignore`에 포함 — 절대 커밋하지 않음

### Fly.io 배포
```bash
fly deploy              # Dockerfile 기반 빌드 후 배포
fly logs                # 실시간 로그
fly secrets set KEY=VAL  # 환경변수 등록
```

`fly.toml` 주요 설정:
- **앱명:** `tour-cast` / **리전:** `nrt` (도쿄)
- **헬스체크:** `GET /api/health` (30초 간격)
- **VM:** `shared-cpu-1x`, 256MB
- **동시요청:** soft 150 / hard 200

### Docker Compose (로컬 전체 실행)
```bash
docker compose up --build
```
- `app`: Node.js 서버 (포트 3000)
- `db`: PostgreSQL 16-alpine (포트 3309)
- `redis`: Redis 7-alpine (포트 6379)

---

## 8. Commit Convention

모든 커밋 메시지는 아래 형식을 **반드시** 사용:

```
[TourCast] Type: 내용
```

| Type | 사용 시점 |
|------|----------|
| `Feat` | 새 기능 추가 |
| `Fix` | 버그 수정 |
| `Refactor` | 기능 변경 없는 코드 개선 |
| `Chore` | 빌드 설정, 의존성, 문서 |
| `Test` | 테스트 추가·수정 |

예시:
```
[TourCast] Feat: syncTourData cron 자동 등록 (매일 03:00)
[TourCast] Fix: 캠핑장 isAvailable 랜덤값 → 실제 예약 API 연동
[TourCast] Chore: CLAUDE.md 초기 작성
```

---

## 9. Common Commands

```bash
# 개발 서버 (ts-node-dev, hot-reload)
npm run dev

# 프로덕션 빌드 + 실행
npm run build && npm start

# Prisma 마이그레이션
npx prisma migrate dev              # 개발: 마이그레이션 생성 + 적용
npx prisma migrate deploy           # 운영: 마이그레이션 적용만
npx prisma generate                 # 클라이언트 재생성 (schema 변경 후)
npx prisma studio                   # DB GUI 브라우저

# 공공데이터 최초 동기화 — 2026-03-29 완료 (관광지 12,775 / 숙박 3,413 / 축제 1,051 / 캠핑장 3,017)
# cron 자동화 미구현 — DB 데이터가 오래됐을 때 수동 재실행
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

# 테스트
npm test                    # 전체 (Prisma 모킹, 실제 DB 불필요)
npm run test:watch          # 감시 모드
npm run test:coverage       # 커버리지 리포트

# Docker
docker compose up --build   # 전체 실행 (앱 + DB + Redis)
docker compose down         # 종료
```

---

## 10. Known Issues (인수인계)

| 번호 | 심각도 | 내용 |
|------|--------|------|
| 1 | ✅ 해결 | 공공데이터 최초 동기화 완료 (관광지 12,775 / 숙박 3,413 / 축제 1,051 / 캠핑장 3,017) |
| 2 | ✅ 해결 | 캠핑 `isAvailable` 랜덤값 → `null` 고정 반환 (실제 예약 API 연동 시 `boolean` 전환 필요) |
| 3 | ✅ 해결 | `SERVICE_API_KEY` Bearer 토큰 인증 미들웨어 적용 (`/api/schedule`, `/api/notification`) |
| 4 | 🟡 보류 | `TouristSpot.overview`: `detailCommon2` API를 contentId 1건씩 호출해야 함 → sync 시간 대폭 증가. TODO 주석 추가됨 (`syncTourData.ts`). 별도 스크립트 분리 또는 배치 처리 방식 결정 후 구현 예정 |
| 5 | 🟢 낮음 | TravelPlatform 실제 연동 미구현 |
