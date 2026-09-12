import { PrismaClient } from ".prisma/warehouse-client";

// Client BACA-SAJA ke database Crackling Warehouse - Tahap 1 penggabungan
// ERP (2026-09-12). Cuma dipakai laporan Cost Center (lib/cost-center-*.ts).
// JANGAN PERNAH panggil method create/update/delete lewat client ini -
// Warehouse py aplikasi & alur kerja sendiri yang tidak boleh diganggu.
const globalForPrisma = globalThis as unknown as { warehouseDb?: PrismaClient };

export const warehouseDb = globalForPrisma.warehouseDb ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.warehouseDb = warehouseDb;
}
