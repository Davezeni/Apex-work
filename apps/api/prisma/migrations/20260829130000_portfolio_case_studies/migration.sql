-- Turn portfolio uploads into structured, searchable case studies.
ALTER TABLE "PortfolioItem" ALTER COLUMN "description" TYPE TEXT;
ALTER TABLE "PortfolioItem" ADD COLUMN "role" TEXT;
ALTER TABLE "PortfolioItem" ADD COLUMN "tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PortfolioItem" ADD COLUMN "outcome" TEXT;
ALTER TABLE "PortfolioItem" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PortfolioItem" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "PortfolioItem_userId_featured_idx" ON "PortfolioItem"("userId", "featured");
