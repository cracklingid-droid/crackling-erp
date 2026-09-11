-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RosterEntry_date_idx" ON "RosterEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_employeeId_date_key" ON "RosterEntry"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

