-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "candidateId" INTEGER,
    "employeeCode" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "birthPlace" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "position" TEXT,
    "outlet" TEXT,
    "employmentStatus" TEXT,
    "joinDate" TIMESTAMP(3),
    "resignDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'onboarding',
    "baseSalary" INTEGER,
    "allowance" INTEGER DEFAULT 0,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountHolder" TEXT,
    "npwp" TEXT,
    "bpjsKesehatanNumber" TEXT,
    "bpjsKetenagakerjaanNumber" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_candidateId_key" ON "Employee"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "HrUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
