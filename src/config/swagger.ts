import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MasilKit API',
      version: '1.0.0',
      description: '관광지, 축제, 숙박, 캠핑장 정보를 통합 제공하는 API',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '로컬 개발 서버',
      },
    ],
    tags: [
      { name: 'Health',      description: '서버 상태 확인' },
      { name: 'TouristSpot', description: '관광지' },
      { name: 'Spot',        description: '관광지 + 주변 숙박' },
      { name: 'Accommodation', description: '숙박' },
      { name: 'Festival',    description: '축제' },
      { name: 'Campsite',    description: '캠핑장' },
      { name: 'Schedule',    description: '여행 일정' },
      { name: 'Geocode',        description: '주소/장소명 → 좌표 변환 (카카오 로컬 API)' },
      { name: 'PublicFacility', description: '반경 내 공공시설 조회 (HIRA 병·의원·약국)' },
    ],
    components: {
      schemas: {
        Pagination: {
          type: 'object',
          properties: {
            total:      { type: 'integer', example: 500 },
            page:       { type: 'integer', example: 1 },
            limit:      { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 25 },
          },
        },
        TouristSpotSummary: {
          type: 'object',
          properties: {
            id:        { type: 'integer', example: 1 },
            contentId: { type: 'string',  example: '127480' },
            title:     { type: 'string',  example: '가거도' },
            address:   { type: 'string',  example: '전라남도 신안군 흑산면 가거도길 38-2' },
            mapX:      { type: 'number',  example: 125.126 },
            mapY:      { type: 'number',  example: 34.052 },
            image:     { type: 'string',  nullable: true, example: 'https://example.com/image.jpg' },
          },
        },
        AccommodationSummary: {
          type: 'object',
          properties: {
            id:        { type: 'integer', example: 1 },
            contentId: { type: 'string',  example: '2012345' },
            title:     { type: 'string',  example: '게스트하우스 리좀' },
            address:   { type: 'string',  nullable: true, example: '경상남도 창원시 마산합포구' },
            mapX:      { type: 'number',  example: 128.571 },
            mapY:      { type: 'number',  example: 35.209 },
            tel:       { type: 'string',  nullable: true, example: '055-000-0000' },
          },
        },
        CampsiteItem: {
          type: 'object',
          properties: {
            id:          { type: 'integer', example: 1 },
            contentId:   { type: 'string',  example: '100001' },
            title:       { type: 'string',  example: '설악산 국립공원 캠핑장' },
            address:     { type: 'string',  nullable: true, example: '강원도 속초시' },
            mapX:        { type: 'number',  example: 128.465 },
            mapY:        { type: 'number',  example: 38.119 },
            induty:      { type: 'string',  nullable: true, example: '일반야영장' },
            resveUrl:    { type: 'string',  nullable: true, example: 'https://www.reservation.go.kr/...' },
            isAvailable: { type: 'boolean', nullable: true, example: null, description: '예약 가능 여부 (실제 예약 API 미연동 — 항상 null)' },
            bookingUrl:  { type: 'string',  example: 'https://www.reservation.go.kr/...', description: 'resveUrl이 없을 경우 네이버 검색 URL 자동 생성' },
          },
        },
        Weather: {
          type: 'object',
          nullable: true,
          properties: {
            temp:   { type: 'string', example: '5.2°C' },
            status: { type: 'string', example: '맑음' },
          },
        },
        Error400: {
          type: 'object',
          properties: {
            message: { type: 'string', example: '유효하지 않은 ID입니다.' },
          },
        },
        Error404: {
          type: 'object',
          properties: {
            message: { type: 'string', example: '리소스를 찾을 수 없습니다.' },
          },
        },
        FacilityItem: {
          type: 'object',
          properties: {
            name:     { type: 'string',  example: '서울성모병원' },
            address:  { type: 'string',  example: '서울특별시 서초구 반포대로 222' },
            lat:      { type: 'number',  example: 37.5010 },
            lng:      { type: 'number',  example: 127.0051 },
            distance: { type: 'integer', example: 320, description: '기준점까지 거리 (미터)' },
            type:     { type: 'string',  example: '상급종합' },
          },
        },
        GeocodeResult: {
          type: 'object',
          properties: {
            lat:     { type: 'number', example: 37.5662952 },
            lng:     { type: 'number', example: 126.977829 },
            name:    { type: 'string', example: '서울특별시청' },
            address: { type: 'string', example: '서울 중구 세종대로 110' },
          },
        },
      },
      parameters: {
        PageParam: {
          name: 'page',
          in: 'query',
          description: '페이지 번호',
          schema: { type: 'integer', default: 1, minimum: 1 },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: '페이지당 항목 수 (최대 100)',
          schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../index.ts'),
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../controllers/*.ts'),
    // 빌드 후 dist 경로도 포함
    path.join(__dirname, '../index.js'),
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../controllers/*.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
