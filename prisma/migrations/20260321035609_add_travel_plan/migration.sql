-- CreateTable
CREATE TABLE "travel_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_plan_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "time" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "travel_plans_userId_idx" ON "travel_plans"("userId");

-- CreateIndex
CREATE INDEX "travel_plan_items_planId_idx" ON "travel_plan_items"("planId");

-- AddForeignKey
ALTER TABLE "travel_plan_items" ADD CONSTRAINT "travel_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "travel_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
