import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { generatePayslipPDF, pdfDocToBuffer } from "@/lib/payslip-pdf";
import { payslipFilename, payslipZipFilename } from "@/lib/payslip-filename";

// Download banyak slip gaji sekaligus jadi 1 file ZIP - browser tidak bisa
// trigger banyak download terpisah otomatis dalam 1x klik, jadi dibungkus
// ZIP. HR bisa pilih semua atau sebagian karyawan lewat checkbox di tabel
// periode gaji. Permintaan Kevin 2026-09-11.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });

  const body = await req.json();
  const itemIds: number[] | undefined = Array.isArray(body.itemIds) ? body.itemIds.map(Number) : undefined;

  const items = await prisma.payrollItem.findMany({
    where: { periodId: period.id, ...(itemIds ? { id: { in: itemIds } } : {}) },
    include: { employee: { select: { name: true, position: true, outlet: true } } },
    orderBy: { employee: { name: "asc" } },
  });
  if (items.length === 0) {
    return NextResponse.json({ error: "Tidak ada karyawan yang dipilih" }, { status: 400 });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const item of items) {
    const buffer = await pdfDocToBuffer(generatePayslipPDF(period, item as never));
    let filename = payslipFilename(period.endDate, item.employee.name);
    // hindari nama file bentrok kalau ada 2 karyawan nama sama persis
    if (usedNames.has(filename)) filename = filename.replace(/\.pdf$/, ` (${item.id}).pdf`);
    usedNames.add(filename);
    zip.file(filename, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const zipFilename = payslipZipFilename(period.endDate, period.category);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="slips.zip"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`,
    },
  });
}
