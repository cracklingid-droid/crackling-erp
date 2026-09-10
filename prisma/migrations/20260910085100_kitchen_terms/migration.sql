-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "agreedB2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "agreedLongShift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "agreedNoPinjol" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "requiresKitchenTerms" BOOLEAN NOT NULL DEFAULT false;

