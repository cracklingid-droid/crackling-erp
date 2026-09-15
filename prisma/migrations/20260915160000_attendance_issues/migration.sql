-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "manualAt" TIMESTAMP(3),
ADD COLUMN     "manualById" INTEGER,
ADD COLUMN     "manualNote" TEXT;

-- CreateTable
CREATE TABLE "AttendanceIssueResolution" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "resolvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceIssueResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceIssueResolution_date_idx" ON "AttendanceIssueResolution"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceIssueResolution_employeeId_date_issueType_key" ON "AttendanceIssueResolution"("employeeId", "date", "issueType");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_manualById_fkey" FOREIGN KEY ("manualById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceIssueResolution" ADD CONSTRAINT "AttendanceIssueResolution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceIssueResolution" ADD CONSTRAINT "AttendanceIssueResolution_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
