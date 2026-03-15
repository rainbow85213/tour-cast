-- AlterTable
ALTER TABLE "schedules"
ADD COLUMN "deviceToken"      TEXT,
ADD COLUMN "notificationSent" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
