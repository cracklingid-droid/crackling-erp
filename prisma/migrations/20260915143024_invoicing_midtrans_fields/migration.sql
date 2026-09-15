/*
  Warnings:

  - You are about to drop the column `xenditQrExpiresAt` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `xenditQrId` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `xenditQrString` on the `Invoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "xenditQrExpiresAt",
DROP COLUMN "xenditQrId",
DROP COLUMN "xenditQrString",
ADD COLUMN     "midtransOrderId" TEXT,
ADD COLUMN     "midtransQrExpiresAt" TIMESTAMP(3),
ADD COLUMN     "midtransQrImageUrl" TEXT,
ADD COLUMN     "midtransQrString" TEXT;
