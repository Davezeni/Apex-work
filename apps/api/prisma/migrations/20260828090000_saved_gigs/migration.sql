-- CreateTable
CREATE TABLE "SavedGig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedGig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedGig_userId_gigId_key" ON "SavedGig"("userId", "gigId");

-- CreateIndex
CREATE INDEX "SavedGig_userId_createdAt_idx" ON "SavedGig"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SavedGig_gigId_idx" ON "SavedGig"("gigId");

-- AddForeignKey
ALTER TABLE "SavedGig" ADD CONSTRAINT "SavedGig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedGig" ADD CONSTRAINT "SavedGig_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
