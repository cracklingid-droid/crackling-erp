-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "kantorBpjsAllowance" INTEGER,
ADD COLUMN     "kantorBpjsEmployerObligation" INTEGER,
ADD COLUMN     "kantorBpjsRemittance" INTEGER,
ADD COLUMN     "kantorFuelRatePerKm" INTEGER,
ADD COLUMN     "kantorIncompleteClockRate" INTEGER,
ADD COLUMN     "kantorLateRate" INTEGER,
ADD COLUMN     "kantorOvertimeRate" INTEGER;

-- AlterTable
ALTER TABLE "PayrollItem" ADD COLUMN     "bonusSales" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bpjsAllowance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bpjsEmployerObligation" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bpjsRemittance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fuelKm" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fuelReimbursement" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "incompleteClockInCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "incompleteClockInDeduction" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "incompleteClockOutCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "incompleteClockOutDeduction" INTEGER NOT NULL DEFAULT 0;
