import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrReadUser, canViewCategory } from "@/lib/hr-access";
import { generatePayslipPDF, pdfDocToBuffer } from "@/lib/payslip-pdf";
import { payslipFilename } from "@/lib/payslip-filename";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const { user, error } = await requireHrReadUser();
  if (error) return error;

  const { id, itemId } = await ctx.params;
  const period = await prisma.payrollPeriod.findUnique({ where: { id: Number(id) } });
  if (!period) return NextResponse.json({ error: "Periode tidak ditemukan" }, { status: 404 });
  if (!canViewCategory(user, period.category)) {
    return NextResponse.json({ error: "Tidak punya akses ke slip ini" }, { status: 403 });
  }

  const item = await prisma.payrollItem.findUnique({
    where: { id: Number(itemId) },
    include: { employee: { select: { name: true, position: true, outlet: true } } },
  });
  if (!item || item.periodId !== period.id) return NextResponse.json({ error: "Slip tidak ditemukan" }, { status: 404 });

  const buffer = await pdfDocToBuffer(generatePayslipPDF(period, item as never));
  const filename = payslipFilename(period.endDate, item.employee.name);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="slip.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
