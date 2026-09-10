-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "offerDocumentReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offerWhatsappSent" BOOLEAN NOT NULL DEFAULT false;
