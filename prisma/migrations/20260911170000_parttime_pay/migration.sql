-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dailyBaseRate" INTEGER;

-- AlterTable
ALTER TABLE "PayrollItem" ADD COLUMN     "partTimePay" INTEGER NOT NULL DEFAULT 0;

