import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { getMissingOnboardingFields } from "@/lib/employee-onboarding";

const VALID_STATUS = ["onboarding", "active", "resigned"];
const STRING_FIELDS = [
  "employeeCode", "ktpNumber", "name", "email", "phone", "birthPlace", "gender", "address",
  "position", "outlet", "employmentStatus",
  "bankName", "bankAccountNumber", "bankAccountHolder",
  "npwp", "bpjsKesehatanNumber", "bpjsKetenagakerjaanNumber",
];

// Field yang perubahannya dicatat otomatis ke EmployeeHistoryEntry - jabatan,
// outlet, status kepegawaian, dan gaji. Field biodata lain (kontak, alamat,
// dst) tidak perlu riwayat. Permintaan Kevin 2026-09-11.
const TRACKED_HISTORY_FIELDS = [
  "position",
  "outlet",
  "employmentStatus",
  "baseSalary",
  "allowance",
  "dailyTransportRate",
  "dailyMealRate",
  "standardWorkDays",
  "dailyBaseRate",
] as const;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const employee = await prisma.employee.findUnique({
    where: { id: Number(id) },
    include: {
      documents: { orderBy: { uploadedAt: "desc" } },
      candidate: { select: { jobPosting: { select: { title: true } } } },
      historyEntries: { orderBy: { effectiveDate: "desc" }, include: { createdBy: { select: { name: true } } } },
    },
  });
  if (!employee) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const { id } = await ctx.params;
  const employeeId = Number(id);
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const f of STRING_FIELDS) {
    if (f in body) data[f] = body[f] || null;
  }
  if (typeof data.name === "string") data.name = (data.name as string).trim();
  if ("birthDate" in body) data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
  if ("joinDate" in body) data.joinDate = body.joinDate ? new Date(body.joinDate) : null;
  if ("resignDate" in body) data.resignDate = body.resignDate ? new Date(body.resignDate) : null;
  if ("baseSalary" in body) data.baseSalary = body.baseSalary === "" || body.baseSalary === null ? null : Number(body.baseSalary);
  if ("allowance" in body) data.allowance = body.allowance === "" || body.allowance === null ? null : Number(body.allowance);
  if ("dailyTransportRate" in body)
    data.dailyTransportRate = body.dailyTransportRate === "" || body.dailyTransportRate === null ? null : Number(body.dailyTransportRate);
  if ("dailyMealRate" in body)
    data.dailyMealRate = body.dailyMealRate === "" || body.dailyMealRate === null ? null : Number(body.dailyMealRate);
  if ("standardWorkDays" in body)
    data.standardWorkDays = body.standardWorkDays === "" || body.standardWorkDays === null ? null : Number(body.standardWorkDays);
  if ("dailyBaseRate" in body)
    data.dailyBaseRate = body.dailyBaseRate === "" || body.dailyBaseRate === null ? null : Number(body.dailyBaseRate);

  const current = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { documents: { select: { type: true } } },
  });
  if (!current) return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });

  if (typeof body.status === "string") {
    if (!VALID_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    }
    if (body.status === "active") {
      const merged = { ...current, ...data };
      const hasKtp = current.documents.some((d) => d.type === "ktp");
      const missing = getMissingOnboardingFields(merged, hasKtp);
      if (missing.length > 0) {
        return NextResponse.json({ error: `Lengkapi dulu: ${missing.join(", ")}.` }, { status: 400 });
      }
    }
    data.status = body.status;
  }

  // Catat perubahan jabatan/outlet/status kepegawaian/gaji ke riwayat -
  // otomatis tiap kali salah satu field ini berubah lewat form edit, HR
  // isi tanggal efektif & keterangan (opsional) di form yang sama.
  // Permintaan Kevin 2026-09-11.
  const historyRows: {
    field: string;
    oldValue: string | null;
    newValue: string | null;
    effectiveDate: Date;
    note: string | null;
    createdById: number;
  }[] = [];
  for (const f of TRACKED_HISTORY_FIELDS) {
    if (!(f in data)) continue;
    const before = current[f];
    const after = data[f] as typeof before;
    const beforeStr = before == null ? null : String(before);
    const afterStr = after == null ? null : String(after);
    if (beforeStr !== afterStr) {
      historyRows.push({
        field: f,
        oldValue: beforeStr,
        newValue: afterStr,
        effectiveDate: body.historyEffectiveDate ? new Date(body.historyEffectiveDate) : new Date(),
        note: typeof body.historyNote === "string" && body.historyNote.trim() ? body.historyNote.trim() : null,
        createdById: user.id,
      });
    }
  }

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({ where: { id: employeeId }, data });
      if (historyRows.length > 0) {
        await tx.employeeHistoryEntry.createMany({
          data: historyRows.map((h) => ({ ...h, employeeId })),
        });
      }
      return updated;
    });
    return NextResponse.json(employee);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return NextResponse.json({ error: "NIK/ID Karyawan sudah dipakai karyawan lain." }, { status: 400 });
    }
    throw e;
  }
}
