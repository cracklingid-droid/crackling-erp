-- Absen mandiri Portal Karyawan: selfie + lokasi GPS per clock-in/clock-out
ALTER TABLE "AttendanceRecord" ADD COLUMN "clockInSelfieUrl" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "clockInLat" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "clockInLng" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "clockOutSelfieUrl" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN "clockOutLat" DOUBLE PRECISION;
ALTER TABLE "AttendanceRecord" ADD COLUMN "clockOutLng" DOUBLE PRECISION;
