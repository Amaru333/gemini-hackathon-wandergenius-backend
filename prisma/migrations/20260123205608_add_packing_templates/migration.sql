-- CreateTable
CREATE TABLE "PackingTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackingTemplate_userId_idx" ON "PackingTemplate"("userId");

-- AddForeignKey
ALTER TABLE "PackingTemplate" ADD CONSTRAINT "PackingTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
