import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentEmployee } from "@/lib/current-employee";
import { generatePayslipPDF, pdfDocToBuffer } from "@/lib/payslip-pdf";
import { payslipFilename } from "@/lib/payslip-filename";

export async function GET(req: Request, ctx: { params: Promise<{ itemId: string }> }) {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { itemId } = await ctx.params;
  const item = await prisma.payrollItem.findUnique({
    where: { id: Number(itemId) },
    include: { period: true, employee: { select: { name: true, position: true, outlet: true } } },
  });
  // Hanya boleh download slip milik sendiri, & periode yang sudah final.
  if (!item || item.employeeId !== employee.id || item.period.status !== "final") {
    return NextResponse.json({ error: "Slip tidak ditemukan" }, { status: 404 });
  }

  const buffer = await pdfDocToBuffer(generatePayslipPDF(item.period, item as never));
  const filename = payslipFilename(item.period.endDate, item.employee.name);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="slip.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
