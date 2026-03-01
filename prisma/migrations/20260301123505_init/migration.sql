-- CreateTable
CREATE TABLE "tourist_spots" (
    "id" SERIAL NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "image" TEXT,
    "overview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_spots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accommodations" (
    "id" SERIAL NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "tel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accommodations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "festivals" (
    "id" SERIAL NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "festivals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campsites" (
    "id" SERIAL NOT NULL,
    "contentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT,
    "mapX" DOUBLE PRECISION,
    "mapY" DOUBLE PRECISION,
    "induty" TEXT,
    "resveUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campsites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tourist_spots_contentId_key" ON "tourist_spots"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "accommodations_contentId_key" ON "accommodations"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "festivals_contentId_key" ON "festivals"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "campsites_contentId_key" ON "campsites"("contentId");
