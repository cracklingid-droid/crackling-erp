-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "workSchedule" TEXT;

-- CreateTable
CREATE TABLE "PayrollEventNote" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEventNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollEventNote_periodId_employeeId_idx" ON "PayrollEventNote"("periodId", "employeeId");

-- AddForeignKey
ALTER TABLE "PayrollEventNote" ADD CONSTRAINT "PayrollEventNote_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEventNote" ADD CONSTRAINT "PayrollEventNote_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEventNote" ADD CONSTRAINT "PayrollEventNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

