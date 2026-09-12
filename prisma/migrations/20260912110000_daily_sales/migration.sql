-- CreateTable
CREATE TABLE "DailySales" (
    "id" SERIAL NOT NULL,
    "outletName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalOmzet" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailySales_outletName_date_key" ON "DailySales"("outletName", "date");

