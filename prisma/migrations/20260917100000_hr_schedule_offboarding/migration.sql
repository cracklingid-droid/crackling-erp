-- Jadwal Kerja: pecah "workSchedule" (teks bebas "HH:MM-HH:MM") jadi 2 field
-- waktu terstruktur. Backfill dulu dari data lama sebelum kolom lama dihapus.
ALTER TABLE "Employee" ADD COLUMN "scheduleStart" TEXT;
ALTER TABLE "Employee" ADD COLUMN "scheduleEnd" TEXT;

UPDATE "Employee"
SET
  "scheduleStart" = split_part("workSchedule", '-', 1),
  "scheduleEnd" = split_part("workSchedule", '-', 2)
WHERE "workSchedule" ~ '^\s*[0-9]{1,2}:[0-9]{2}\s*-\s*[0-9]{1,2}:[0-9]{2}\s*$';

ALTER TABLE "Employee" DROP COLUMN "workSchedule";

-- Checklist Offboarding
ALTER TABLE "Employee" ADD COLUMN "offboardingAssetReturned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "offboardingPortalDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "offboardingExitInterviewDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "offboardingDocumentsComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Employee" ADD COLUMN "offboardingDepositSettled" BOOLEAN NOT NULL DEFAULT false;
