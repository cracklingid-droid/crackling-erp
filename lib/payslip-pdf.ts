import PDFDocument from "pdfkit";
import { DEDUCTION_FIELD_KEYS, fieldsForCategory, computeNetPay, type FieldDef } from "./payroll-fields";

type Item = {
  employee: { name: string; position: string | null; outlet: string | null };
  daysPresent: number;
  [key: string]: unknown;
};
type Period = { label: string; startDate: Date; endDate: Date; category: string };

function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Bikin PDF slip gaji langsung di server (bukan lewat print dialog browser)
// pakai pdfkit - dipilih drpd headless Chromium (Puppeteer) krn jauh lebih
// ringan & stabil di Vercel serverless (tanpa binary Chromium, cold start
// cepat), penting krn dipakai utk download banyak slip sekaligus (ZIP).
// Layout disederhanakan jadi 1 kolom (bukan 2 kolom spt versi HTML) supaya
// gampang dirawat manual dgn pdfkit. Permintaan Kevin 2026-09-11.
export function generatePayslipPDF(period: Period, item: Item): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 48 });

  const category = period.category;
  const categoryLabel = category === "outlet" ? "Outlet" : "Kantor";
  const fields = fieldsForCategory(category);
  const earningFields = fields.filter((f: FieldDef) => !DEDUCTION_FIELD_KEYS.has(f.key) && f.key !== "otherAdjustment");
  const deductionFields = fields.filter((f: FieldDef) => DEDUCTION_FIELD_KEYS.has(f.key));
  const otherAdjustment = (item.otherAdjustment as number) ?? 0;

  const nonZeroEarnings = earningFields.filter((f) => ((item[f.key] as number) ?? 0) !== 0);
  const nonZeroDeductions = deductionFields.filter((f) => ((item[f.key] as number) ?? 0) !== 0);
  const totalEarnings = nonZeroEarnings.reduce((s, f) => s + ((item[f.key] as number) ?? 0), 0) + Math.max(0, otherAdjustment);
  const totalDeductions = nonZeroDeductions.reduce((s, f) => s + ((item[f.key] as number) ?? 0), 0) + Math.max(0, -otherAdjustment);
  const netPay = computeNetPay(item as unknown as Record<string, number>, fields);
  const baseSalary = (item.baseSalary as number) ?? 0;

  const maroon = "#800000";
  const gray = "#6b6b6b";
  const black = "#1a1a1a";

  doc.font("Helvetica-Bold").fontSize(16).fillColor(maroon).text("CRACKLING", 48, 48);
  doc.font("Helvetica").fontSize(10).fillColor(gray).text(`Slip Gaji ${categoryLabel}`, 48, 68);
  doc.font("Helvetica").fontSize(9).fillColor(gray).text(period.label, 0, 48, { align: "right" });
  doc.text(`${formatDate(period.startDate)} - ${formatDate(period.endDate)}`, 0, 62, { align: "right" });

  doc.moveTo(48, 90).lineTo(547, 90).strokeColor("#dddddd").stroke();

  let y = 105;
  const row = (label: string, value: string) => {
    doc.font("Helvetica").fontSize(9).fillColor(gray).text(label, 48, y);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(black).text(value, 48, y + 13);
  };
  row("Nama Karyawan", item.employee.name);
  doc.font("Helvetica").fontSize(9).fillColor(gray).text("Jabatan", 300, y);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(black).text(item.employee.position || "-", 300, y + 13);
  y += 40;
  row("Outlet/Cabang", item.employee.outlet || "-");
  doc.font("Helvetica").fontSize(9).fillColor(gray).text("Hari Hadir", 300, y);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(black).text(`${item.daysPresent} hari`, 300, y + 13);
  y += 45;

  const section = (title: string, rows: { label: string; value: number }[], extra?: { label: string; value: number }) => {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(black).text(title, 48, y);
    y += 15;
    doc.moveTo(48, y).lineTo(547, y).strokeColor("#eeeeee").stroke();
    y += 6;
    if (rows.length === 0 && !extra) {
      doc.font("Helvetica").fontSize(9).fillColor(gray).text("-", 48, y);
      y += 14;
    } else {
      for (const r of rows) {
        doc.font("Helvetica").fontSize(9).fillColor(gray).text(r.label, 48, y);
        doc.font("Helvetica").fontSize(9).fillColor(black).text(formatRupiah(r.value), 0, y, { align: "right", width: 547 - 48 });
        y += 14;
      }
      if (extra) {
        doc.font("Helvetica").fontSize(9).fillColor(gray).text(extra.label, 48, y);
        doc.font("Helvetica").fontSize(9).fillColor(black).text(formatRupiah(extra.value), 0, y, { align: "right", width: 547 - 48 });
        y += 14;
      }
    }
    y += 10;
  };

  section(
    "Penghasilan",
    nonZeroEarnings.map((f) => ({ label: f.label, value: item[f.key] as number })),
    otherAdjustment > 0 ? { label: "Penyesuaian Lain", value: otherAdjustment } : undefined
  );
  section(
    "Potongan",
    nonZeroDeductions.map((f) => ({ label: f.label, value: item[f.key] as number })),
    otherAdjustment < 0 ? { label: "Penyesuaian Lain", value: -otherAdjustment } : undefined
  );

  doc.moveTo(48, y).lineTo(547, y).strokeColor("#dddddd").stroke();
  y += 8;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9).fillColor(bold ? black : gray).text(label, 48, y);
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(bold ? 11 : 9)
      .fillColor(black)
      .text(value, 0, y, { align: "right", width: 547 - 48 });
    y += bold ? 18 : 14;
  };
  totalRow("Total Penghasilan", formatRupiah(totalEarnings));
  totalRow("Total Potongan", formatRupiah(totalDeductions));
  y += 2;
  doc.moveTo(48, y).lineTo(547, y).strokeColor("#dddddd").stroke();
  y += 6;
  totalRow("Gaji Bersih", formatRupiah(netPay), true);

  if (category === "outlet") {
    y += 8;
    doc.moveTo(48, y).lineTo(547, y).strokeColor("#dddddd").stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(black).text("Rincian Transfer", 48, y);
    y += 16;
    if (baseSalary > 0) {
      totalRow("Transfer 1 (Tgl 10) - Gaji Pokok", formatRupiah(baseSalary));
      totalRow("Transfer 2 (Tgl 25) - Sisa Penghasilan", formatRupiah(netPay - baseSalary));
    } else {
      totalRow("Transfer (Tgl 25)", formatRupiah(netPay));
    }
  }

  return doc;
}

export function pdfDocToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
