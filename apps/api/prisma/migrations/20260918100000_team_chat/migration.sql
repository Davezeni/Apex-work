-- Team shared chat: link a group conversation to an agency/teams workspace.
-- Additive only: nullable column, safe for existing rows.
ALTER TABLE "Conversation" ADD COLUMN "agencyId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_agencyId_idx" ON "Conversation"("agencyId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
