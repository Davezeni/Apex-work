-- Keep seeded skills visible while allowing admin review of user-created skills.
ALTER TABLE "Skill" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Skill" ADD COLUMN "createdById" TEXT;

CREATE INDEX "Skill_isApproved_name_idx" ON "Skill"("isApproved", "name");
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
