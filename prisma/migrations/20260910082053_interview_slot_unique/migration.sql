-- DropIndex
DROP INDEX "InterviewSlot_scheduledAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "InterviewSlot_scheduledAt_key" ON "InterviewSlot"("scheduledAt");

