-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_manager',
    "managerDecision" TEXT,
    "managerDecisionAt" TIMESTAMP(3),
    "managerDecisionById" INTEGER,
    "managerNote" TEXT,
    "hrDecision" TEXT,
    "hrDecisionAt" TIMESTAMP(3),
    "hrDecisionById" INTEGER,
    "hrNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_date_idx" ON "OvertimeRequest"("employeeId", "date");

-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_managerDecisionById_fkey" FOREIGN KEY ("managerDecisionById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_hrDecisionById_fkey" FOREIGN KEY ("hrDecisionById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
