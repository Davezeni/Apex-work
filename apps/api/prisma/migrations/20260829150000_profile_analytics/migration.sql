-- Privacy-conscious aggregate analytics for public profiles, CVs and portfolios.
CREATE TYPE "ProfileEventType" AS ENUM ('PROFILE_VIEW', 'CV_VIEW', 'CV_DOWNLOAD', 'PORTFOLIO_VIEW', 'PORTFOLIO_DOWNLOAD');

CREATE TABLE "ProfileEvent" (
    "id" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "viewerId" TEXT,
    "type" "ProfileEventType" NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileEvent_subjectUserId_type_createdAt_idx" ON "ProfileEvent"("subjectUserId", "type", "createdAt" DESC);
CREATE INDEX "ProfileEvent_subjectUserId_createdAt_idx" ON "ProfileEvent"("subjectUserId", "createdAt" DESC);

ALTER TABLE "ProfileEvent" ADD CONSTRAINT "ProfileEvent_subjectUserId_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileEvent" ADD CONSTRAINT "ProfileEvent_viewerId_fkey"
  FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
