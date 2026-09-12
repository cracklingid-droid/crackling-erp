-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "contractEndDate" TIMESTAMP(3),
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "reportsToId" INTEGER;

-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN     "expiryDate" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportsToId_fkey" FOREIGN KEY ("reportsToId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

