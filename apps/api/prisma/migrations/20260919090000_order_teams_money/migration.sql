-- Money + teams: order assignment with payout split, agency default share,
-- joint (team) bids. All additive; existing rows keep today's behavior.
ALTER TABLE "Order" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "assigneeSharePct" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_assignedToUserId_idx" ON "Order"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Agency" ADD COLUMN "defaultAssigneeSharePct" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "Bid" ADD COLUMN "agencyId" TEXT;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Joint-bid crew (implicit many-to-many)
CREATE TABLE "_BidCrew" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BidCrew_AB_unique" ON "_BidCrew"("A", "B");

-- CreateIndex
CREATE INDEX "_BidCrew_B_index" ON "_BidCrew"("B");

-- AddForeignKey
ALTER TABLE "_BidCrew" ADD CONSTRAINT "_BidCrew_A_fkey" FOREIGN KEY ("A") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BidCrew" ADD CONSTRAINT "_BidCrew_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
