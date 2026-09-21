-- CreateTable
CREATE TABLE "JobSave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobSave_userId_jobId_key" ON "JobSave"("userId", "jobId");

-- CreateIndex
CREATE INDEX "JobSave_userId_createdAt_idx" ON "JobSave"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JobSave_jobId_idx" ON "JobSave"("jobId");

-- AddForeignKey
ALTER TABLE "JobSave" ADD CONSTRAINT "JobSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSave" ADD CONSTRAINT "JobSave_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
