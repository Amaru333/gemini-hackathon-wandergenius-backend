-- CreateTable
CREATE TABLE "TripCollaborator" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "inviteToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityVote" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "activityIndex" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripReview" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetRating" INTEGER NOT NULL,
    "locationRating" INTEGER NOT NULL,
    "activitiesRating" INTEGER NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripCollaborator_inviteToken_key" ON "TripCollaborator"("inviteToken");

-- CreateIndex
CREATE INDEX "TripCollaborator_tripId_idx" ON "TripCollaborator"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripCollaborator_tripId_email_key" ON "TripCollaborator"("tripId", "email");

-- CreateIndex
CREATE INDEX "ActivityVote_tripId_idx" ON "ActivityVote"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityVote_tripId_day_activityIndex_userId_key" ON "ActivityVote"("tripId", "day", "activityIndex", "userId");

-- CreateIndex
CREATE INDEX "TripReview_tripId_idx" ON "TripReview"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TripReview_tripId_userId_key" ON "TripReview"("tripId", "userId");

-- AddForeignKey
ALTER TABLE "TripCollaborator" ADD CONSTRAINT "TripCollaborator_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "PlannedTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripCollaborator" ADD CONSTRAINT "TripCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityVote" ADD CONSTRAINT "ActivityVote_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "PlannedTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityVote" ADD CONSTRAINT "ActivityVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripReview" ADD CONSTRAINT "TripReview_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "PlannedTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripReview" ADD CONSTRAINT "TripReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
