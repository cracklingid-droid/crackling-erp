-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dailyMealRate" INTEGER,
ADD COLUMN     "dailyTransportRate" INTEGER,
ADD COLUMN     "standardWorkDays" INTEGER;

-- AlterTable
ALTER TABLE "PayrollItem" ADD COLUMN     "bonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositDeduction" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositRefund" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "incidentDeduction" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lateDeduction" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serviceCharge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "warningLetterDeduction" INTEGER NOT NULL DEFAULT 0;

