-- DropForeignKey
ALTER TABLE "CandidateStageEvent" DROP CONSTRAINT "CandidateStageEvent_createdById_fkey";

-- AlterTable
ALTER TABLE "CandidateStageEvent" ALTER COLUMN "createdById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CandidateStageEvent" ADD CONSTRAINT "CandidateStageEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

