-- Flag-queue triage: assignee, workflow status and moderator notes on Gig.

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('QUEUED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Gig" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "moderationAssignee" TEXT,
ADD COLUMN     "moderatorNotes" TEXT,
ADD COLUMN     "moderatedAt" TIMESTAMP(3);
