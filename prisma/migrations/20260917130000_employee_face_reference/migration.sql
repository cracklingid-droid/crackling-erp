-- Foto acuan wajah karyawan utk verifikasi absen mandiri (cegah titip absen)
ALTER TABLE "Employee" ADD COLUMN "faceReferenceUrl" TEXT;
ALTER TABLE "Employee" ADD COLUMN "faceReferenceUpdatedAt" TIMESTAMP(3);
