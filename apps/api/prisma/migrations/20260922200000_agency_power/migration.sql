-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "agencyId" TEXT;
ALTER TABLE "Agency" ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- CreateTable
CREATE TABLE "AgencyProject" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAgencyInvite" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAgencyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_agencyId_idx" ON "Order"("agencyId");

-- CreateIndex
CREATE INDEX "AgencyProject_agencyId_createdAt_idx" ON "AgencyProject"("agencyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "JobAgencyInvite_jobId_agencyId_key" ON "JobAgencyInvite"("jobId", "agencyId");

-- CreateIndex
CREATE INDEX "JobAgencyInvite_agencyId_createdAt_idx" ON "JobAgencyInvite"("agencyId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agency" ADD CONSTRAINT "Agency_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyProject" ADD CONSTRAINT "AgencyProject_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAgencyInvite" ADD CONSTRAINT "JobAgencyInvite_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAgencyInvite" ADD CONSTRAINT "JobAgencyInvite_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAgencyInvite" ADD CONSTRAINT "JobAgencyInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
