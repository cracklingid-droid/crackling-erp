-- Titik lokasi (lat/lng) + radius per outlet, diatur HR dari HP saat
-- berdiri di lokasi outlet (menggantikan konfigurasi hardcode placeholder)
CREATE TABLE "OutletLocation" (
    "id" SERIAL NOT NULL,
    "outlet" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusMeters" INTEGER NOT NULL DEFAULT 50,
    "updatedById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutletLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutletLocation_outlet_key" ON "OutletLocation"("outlet");

ALTER TABLE "OutletLocation" ADD CONSTRAINT "OutletLocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
