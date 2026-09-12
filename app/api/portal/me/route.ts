import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/current-employee";

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) return NextResponse.json({ employee: null }, { status: 401 });
  return NextResponse.json({
    employee: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      position: employee.position,
      outlet: employee.outlet,
      photoUrl: employee.photoUrl,
    },
  });
}
