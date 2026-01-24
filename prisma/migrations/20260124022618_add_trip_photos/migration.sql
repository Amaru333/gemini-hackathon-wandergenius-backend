-- CreateTable
CREATE TABLE "TripPhoto" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "takenAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripPhoto_tripId_idx" ON "TripPhoto"("tripId");

-- CreateIndex
CREATE INDEX "TripPhoto_tripId_day_idx" ON "TripPhoto"("tripId", "day");

-- AddForeignKey
ALTER TABLE "TripPhoto" ADD CONSTRAINT "TripPhoto_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "PlannedTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
