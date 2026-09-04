-- Add seller rebuttal to Review (review replies / seller response).
ALTER TABLE "Review"
  ADD COLUMN "sellerReply" TEXT,
  ADD COLUMN "sellerRepliedAt" TIMESTAMP(3),
  ADD COLUMN "sellerReplyEditedAt" TIMESTAMP(3);

-- New notification type for seller responses to reviews.
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_REPLY';
