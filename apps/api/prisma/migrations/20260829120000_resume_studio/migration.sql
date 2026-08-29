-- Resume Studio metadata and extensible sections.
ALTER TABLE "Resume" ADD COLUMN "targetRole" TEXT;
ALTER TABLE "Resume" ADD COLUMN "accentColor" TEXT;
ALTER TABLE "Resume" ADD COLUMN "templateId" TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE "Resume" ADD COLUMN "contentJson" JSONB;
ALTER TABLE "Resume" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "ResumeTemplatePurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

CREATE TABLE "ResumeTemplatePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "amountEtb" INTEGER NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" "ResumeTemplatePurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeTemplatePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResumeTemplatePurchase_providerRef_key" ON "ResumeTemplatePurchase"("providerRef");
CREATE UNIQUE INDEX "ResumeTemplatePurchase_userId_templateId_key" ON "ResumeTemplatePurchase"("userId", "templateId");
CREATE INDEX "ResumeTemplatePurchase_userId_status_idx" ON "ResumeTemplatePurchase"("userId", "status");
CREATE INDEX "ResumeTemplatePurchase_providerRef_status_idx" ON "ResumeTemplatePurchase"("providerRef", "status");

ALTER TABLE "ResumeTemplatePurchase" ADD CONSTRAINT "ResumeTemplatePurchase_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
