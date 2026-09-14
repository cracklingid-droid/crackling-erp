/*
  Warnings:

  - You are about to drop the column `accountId` on the `DirectExpense` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DirectExpense" DROP COLUMN "accountId",
ADD COLUMN     "receiptUrl" TEXT;

-- AlterTable
ALTER TABLE "SalesRecord" ADD COLUMN     "total" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DirectExpenseLine" (
    "id" SERIAL NOT NULL,
    "directExpenseId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,

    CONSTRAINT "DirectExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPhoto" (
    "id" SERIAL NOT NULL,
    "warehouseItemId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingNote" (
    "id" SERIAL NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPhoto_warehouseItemId_key" ON "ProductPhoto"("warehouseItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingNote_yearMonth_key" ON "AccountingNote"("yearMonth");

-- AddForeignKey
ALTER TABLE "DirectExpenseLine" ADD CONSTRAINT "DirectExpenseLine_directExpenseId_fkey" FOREIGN KEY ("directExpenseId") REFERENCES "DirectExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
