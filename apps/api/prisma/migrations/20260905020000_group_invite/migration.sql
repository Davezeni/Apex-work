-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "inviteToken" TEXT;
CREATE UNIQUE INDEX "Conversation_inviteToken_key" ON "Conversation"("inviteToken");
