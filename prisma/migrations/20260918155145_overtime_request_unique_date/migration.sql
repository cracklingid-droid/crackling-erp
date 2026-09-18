-- DropIndex
DROP INDEX "OvertimeRequest_employeeId_date_idx";

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRequest_employeeId_date_key" ON "OvertimeRequest"("employeeId", "date");

