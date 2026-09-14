import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireHrReadUser, canDecideOvertimeStage } from "@/lib/hr-access";
import { employeeCategory } from "@/lib/payroll-config";

// Approval 2 tahap Pengajuan Lembur SPV - "manager" memutuskan tahap
// pending_manager, HR (hr_manager/hr_staff/owner/developer) memutuskan
// tahap pending_hr. Ditolak di tahap manapun langsung berhenti (status
// "rejected", tidak lanjut ke tahap berikutnya). Cuma catatan administratif
// - TIDAK menyentuh PayrollItem/perhitungan lembur sama sekali, sesuai
// keputusan Kevin 2026-09-14 ("cuma jadi izin/bukti tercatat").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireHrReadUser();
  if (error) return error;

  const { id } = await params;
  const overtimeRequest = await prisma.overtimeRequest.findUnique({
    where: { id: Number(id) },
    include: { employee: { select: { outlet: true } } },
  });
  if (!overtimeRequest) return NextResponse.json({ error: "Pengajuan tidak ditemukan" }, { status: 404 });

  if (user.role === "manager" && employeeCategory(overtimeRequest.employee.outlet) !== "outlet") {
    return NextResponse.json({ error: "Tidak punya akses" }, { status: 403 });
  }
  if (!canDecideOvertimeStage(user, overtimeRequest.status)) {
    return NextResponse.json({ error: "Tidak punya akses utk tahap ini, atau pengajuan sudah diputuskan" }, { status: 403 });
  }

  const body = await req.json();
  const { decision, note } = body as { decision?: string; note?: string };
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "Keputusan harus 'approved' atau 'rejected'" }, { status: 400 });
  }

  const isManagerStage = overtimeRequest.status === "pending_manager";
  const nextStatus = decision === "rejected" ? "rejected" : isManagerStage ? "pending_hr" : "approved";

  // updateMany + where status masih sama spt yg baru dibaca - jaga-jaga dari
  // race condition (2 klik approve nyaris bersamaan) dobel-apply keputusan.
  const { count } = await prisma.overtimeRequest.updateMany({
    where: { id: overtimeRequest.id, status: overtimeRequest.status },
    data: isManagerStage
      ? {
          managerDecision: decision,
          managerDecisionAt: new Date(),
          managerDecisionById: user.id,
          managerNote: note?.trim() || null,
          status: nextStatus,
        }
      : {
          hrDecision: decision,
          hrDecisionAt: new Date(),
          hrDecisionById: user.id,
          hrNote: note?.trim() || null,
          status: nextStatus,
        },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Pengajuan sudah diputuskan pihak lain, muat ulang halaman" }, { status: 409 });
  }

  const updated = await prisma.overtimeRequest.findUnique({ where: { id: overtimeRequest.id } });
  return NextResponse.json(updated);
}
