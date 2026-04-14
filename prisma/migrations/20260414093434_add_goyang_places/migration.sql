-- CreateTable
CREATE TABLE "goyang_places" (
    "id" SERIAL NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentTypeId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "image" TEXT,
    "tel" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goyang_places_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goyang_places_contentId_key" ON "goyang_places"("contentId");

-- CreateIndex
CREATE INDEX "goyang_places_category_idx" ON "goyang_places"("category");

-- CreateIndex
CREATE INDEX "goyang_places_contentTypeId_idx" ON "goyang_places"("contentTypeId");
