import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { fieldsForCategory, computeNetPay, DEDUCTION_FIELD_KEYS } from "@/lib/payroll-fields";
import { computeEmployeeDailyDetail } from "@/lib/payroll-daily-detail";
import { payrollExcelFilename } from "@/lib/payslip-filename";

const INFO_FIELDS = [{ key: "lateCount", label: "Jml Telat" }];
const CATEGORY_LABEL: Record<string, string> = { outlet: "Outlet", kantor: "Kantor" };

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
const RUPIAH_FORMAT = "#,##0";

function formatDateID(d: Date): string {
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

// Export Payroll Outlet/Kantor ke Excel 2 sheet, persis konsep "sheet
// Excel" yang dipakai Kevin sebelumnya - Sheet 1 "Detail Harian" (tanggal
// kerja per tanggal cutoff kehadiran, gaji pokok/transport/uang makan
// harian, semua komponen masuk & keluar per tanggal - dari
// lib/payroll-daily-detail.ts, SATU sumber kebenaran yang sama dipakai tab
// "Detail Harian" & halaman /rincian, supaya totalnya selalu cocok dgn
// Sheet 2), Sheet 2 "Rekap Bulanan" (persis tabel utama halaman periode).
// Permintaan Kevin 2026-09-12.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: Number(id) },
    include: {
      items: {
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              position: true,
              outlet: true,
              baseSalary: true,
              dailyTransportRate: true,
              dailyMealRate: true,
              dailyBaseRate: true,
              workSchedule: true,
            },
          },
        },
        orderBy: { employee: { name: "asc" } },
      },
      eventNotes: { orderBy: { date: "asc" } },
    },
  });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });

  const employeeIds = period.items.map((it) => it.employeeId);
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: period.startDate, lte: period.endDate } },
    orderBy: { date: "asc" },
  });

  const editableFields = fieldsForCategory(period.category);
  const infoFields = period.category === "outlet" ? INFO_FIELDS : [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Crackling ERP";
  workbook.created = new Date();

  // ---------- Sheet 1: Detail Harian ----------
  const sheet1 = workbook.addWorksheet("Detail Harian", { views: [{ state: "frozen", ySplit: 0 }] });
  const isOutletPartTimeAny = period.items.some((it) => it.employee.dailyBaseRate != null);
  const sheet1Header = [
    "Tanggal",
    "Hadir",
    "Jam Masuk",
    "Jam Pulang",
    "Gaji Pokok",
    ...(isOutletPartTimeAny ? ["Gaji Part Time"] : []),
    "Uang Makan",
    "Uang Transport",
    "Lembur (menit)",
    "Lembur (Rp)",
    "Potongan Kejadian",
    "Potongan SP",
    "Potongan Telat",
    "Keterangan",
    "Total Hari Ini",
  ];
  sheet1.columns = sheet1Header.map((label) => ({ header: label, width: label === "Keterangan" ? 28 : 14 }));

  for (const item of period.items) {
    const nameRow = sheet1.addRow([`${item.employee.name}${item.employee.position ? ` - ${item.employee.position}` : ""}${item.employee.outlet ? ` (${item.employee.outlet})` : ""}`]);
    nameRow.font = { bold: true };
    sheet1.mergeCells(nameRow.number, 1, nameRow.number, sheet1Header.length);

    const headerRow = sheet1.addRow(sheet1Header);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = HEADER_FILL;
    });

    const daily = computeEmployeeDailyDetail(
      {
        daysPresent: item.daysPresent,
        baseSalary: item.baseSalary,
        partTimePay: item.partTimePay,
        overtimePay: item.overtimePay,
        incidentDeduction: item.incidentDeduction,
        warningLetterDeduction: item.warningLetterDeduction,
        lateDeduction: item.lateDeduction,
        employee: item.employee,
      },
      period.startDate,
      period.endDate,
      period.eventNotes.filter((n) => n.employeeId === item.employeeId),
      attendanceRecords.filter((r) => r.employeeId === item.employeeId)
    );

    for (const r of daily.rows) {
      const potongan = r.potonganKejadian + r.potonganSP + r.potonganTelat;
      const values = [
        formatDateID(new Date(r.date)),
        r.hadir ? "Ya" : "Tidak",
        r.clockIn ?? "-",
        r.clockOut ?? "-",
        r.hadir ? r.gajiPokok : 0,
        ...(isOutletPartTimeAny ? [r.hadir ? r.gajiPartTime : 0] : []),
        r.hadir ? r.uangMakan : 0,
        r.hadir ? r.uangTransport : 0,
        r.overtimeMinutes || 0,
        r.lembur || 0,
        r.potonganKejadian || 0,
        r.potonganSP || 0,
        r.potonganTelat || 0,
        r.keterangan,
        r.hadir || potongan > 0 ? r.net : 0,
      ];
      const row = sheet1.addRow(values);
      if (!r.hadir) row.font = { color: { argb: "FF9CA3AF" } };
      for (let c = 5; c <= sheet1Header.length; c++) {
        if (sheet1Header[c - 1] === "Keterangan") continue;
        row.getCell(c).numFmt = RUPIAH_FORMAT;
      }
    }

    for (const adj of daily.adjustments) {
      const row = sheet1.addRow([adj.label]);
      sheet1.mergeCells(row.number, 1, row.number, sheet1Header.length - 1);
      row.font = { italic: true, size: 10 };
      row.getCell(sheet1Header.length).value = adj.amount;
      row.getCell(sheet1Header.length).numFmt = RUPIAH_FORMAT;
      row.getCell(sheet1Header.length).font = { italic: true, size: 10 };
    }

    const totalRow = sheet1.addRow(["Total dari Detail Harian"]);
    sheet1.mergeCells(totalRow.number, 1, totalRow.number, sheet1Header.length - 1);
    totalRow.font = { bold: true };
    totalRow.getCell(sheet1Header.length).value = daily.totalFromDaily;
    totalRow.getCell(sheet1Header.length).numFmt = RUPIAH_FORMAT;
    totalRow.getCell(sheet1Header.length).font = { bold: true };

    const noteRow = sheet1.addRow([
      "Catatan: BPJS, PPh21, Kasbon, Bayar/Kembali Deposit, Bonus, Service Charge & Penyesuaian Lain tidak tercatat per tanggal kejadian - lihat Sheet 2 (Rekap Bulanan).",
    ]);
    sheet1.mergeCells(noteRow.number, 1, noteRow.number, sheet1Header.length);
    noteRow.font = { italic: true, size: 9, color: { argb: "FF6B7280" } };

    sheet1.addRow([]);
  }

  // ---------- Sheet 2: Rekap Bulanan ----------
  const sheet2 = workbook.addWorksheet("Rekap Bulanan");
  const sheet2Header = [
    "Karyawan",
    "Posisi",
    "Outlet",
    "Hadir",
    "Lembur (menit)",
    ...infoFields.map((f) => f.label),
    ...editableFields.map((f) => f.label),
    "Gaji Bersih",
  ];
  sheet2.columns = sheet2Header.map((label) => ({ header: label, width: label === "Karyawan" ? 22 : label === "Posisi" ? 16 : 15 }));
  const sheet2HeaderRow = sheet2.getRow(1);
  sheet2HeaderRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });

  let totalNetPay = 0;
  for (const item of period.items) {
    const record = item as unknown as Record<string, number>;
    const netPay = computeNetPay(record, editableFields);
    totalNetPay += netPay;
    const row = sheet2.addRow([
      item.employee.name,
      item.employee.position ?? "-",
      item.employee.outlet ?? "-",
      item.daysPresent,
      item.overtimeMinutes,
      ...infoFields.map((f) => record[f.key] ?? 0),
      ...editableFields.map((f) => {
        const v = record[f.key] ?? 0;
        return DEDUCTION_FIELD_KEYS.has(f.key) ? -v : v;
      }),
      netPay,
    ]);
    for (let c = 6 + infoFields.length; c <= sheet2Header.length; c++) {
      row.getCell(c).numFmt = RUPIAH_FORMAT;
    }
  }

  const totalRow2 = sheet2.addRow(["Total", "", "", "", "", ...infoFields.map(() => ""), ...editableFields.map(() => ""), totalNetPay]);
  totalRow2.font = { bold: true };
  totalRow2.getCell(sheet2Header.length).numFmt = RUPIAH_FORMAT;

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = payrollExcelFilename(period.endDate, period.category);
  const categoryLabel = CATEGORY_LABEL[period.category] ?? period.category;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="gaji-${categoryLabel.toLowerCase()}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
