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
│   └── spotController.ts     # 반경 내 숙박 검색 (Haversine raw query)
├── routes/
│   ├── touristSpots.ts       # GET /tourist-spots 목록·상세
│   └── spots.ts              # GET /api/spots/:id/with-accommodations
├── services/
│   └── apiClient.ts          # 공공데이터포털 Axios 인스턴스 (재시도 로직 포함)
└── jobs/
    └── syncTourData.ts       # 관광 데이터 동기화 Job
prisma/
├── schema.prisma             # DB 모델 정의
└── migrations/               # 마이그레이션 히스토리
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
      "image": "http://..."
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

## 환경 변수

| 키 | 설명 |
|----|------|
| `PORT` | 서버 포트 (기본값: 3000) |
| `TOUR_API_KEY` | 한국관광공사 TourAPI 인증키 (Encoding) |
| `CAMP_API_KEY` | 한국관광공사 GoCamping API 인증키 (Encoding) |
| `DB_HOST` | PostgreSQL 호스트 |
| `DB_PORT` | PostgreSQL 포트 |
| `DB_NAME` | DB 이름 |
| `DB_USER` | DB 사용자 |
| `DB_PASSWORD` | DB 비밀번호 |
| `DATABASE_URL` | Prisma 연결 URL |
