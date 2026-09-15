-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "employeeId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Contact_employeeId_key" ON "Contact"("employeeId");
