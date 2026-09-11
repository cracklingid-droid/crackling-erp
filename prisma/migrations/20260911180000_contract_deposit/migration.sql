-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "depositBalance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "depositInstallmentsPaid" INTEGER NOT NULL DEFAULT 0;

