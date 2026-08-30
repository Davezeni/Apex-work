-- Admin-controlled Resume Studio availability and one-time pricing overrides.
CREATE TABLE "ResumeTemplateConfig" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "priceEtb" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResumeTemplateConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResumeTemplateConfig_templateId_key" ON "ResumeTemplateConfig"("templateId");
CREATE INDEX "ResumeTemplateConfig_isAvailable_idx" ON "ResumeTemplateConfig"("isAvailable");
