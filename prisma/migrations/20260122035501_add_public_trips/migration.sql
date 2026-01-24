/*
  Warnings:

  - A unique constraint covering the columns `[shareId]` on the table `PlannedTrip` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PlannedTrip" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlannedTrip_shareId_key" ON "PlannedTrip"("shareId");
