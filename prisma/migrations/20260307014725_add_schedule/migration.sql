-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" JSONB NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "publicDataRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedules_userId_idx" ON "schedules"("userId");

-- CreateIndex
CREATE INDEX "schedules_scheduledAt_idx" ON "schedules"("scheduledAt");
