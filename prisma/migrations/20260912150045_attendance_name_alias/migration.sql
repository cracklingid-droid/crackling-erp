-- CreateTable
CREATE TABLE "AttendanceNameAlias" (
    "id" SERIAL NOT NULL,
    "machineName" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceNameAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceNameAlias_machineName_key" ON "AttendanceNameAlias"("machineName");

-- AddForeignKey
ALTER TABLE "AttendanceNameAlias" ADD CONSTRAINT "AttendanceNameAlias_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceNameAlias" ADD CONSTRAINT "AttendanceNameAlias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
