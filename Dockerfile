# ── 1단계: 빌드 ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# 패키지 먼저 복사 (레이어 캐시 활용)
COPY package*.json ./

# Prisma 관련 파일 복사 (generate 전에 필요)
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci

# Prisma 클라이언트 생성 (src/generated/prisma 에 생성됨)
RUN npx prisma generate

# 소스 빌드
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── 2단계: 프로덕션 이미지 ──────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# 컴파일된 결과물 복사 (dist/generated/prisma 포함)
COPY --from=builder /app/dist ./dist

# prisma migrate deploy 를 위해 스키마·마이그레이션 복사
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
