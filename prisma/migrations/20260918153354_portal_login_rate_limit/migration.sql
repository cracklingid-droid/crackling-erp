-- CreateTable
CREATE TABLE "PortalLoginAttempt" (
    "id" SERIAL NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalLoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalLoginAttempt_employeeCode_createdAt_idx" ON "PortalLoginAttempt"("employeeCode", "createdAt");

-- CreateIndex
CREATE INDEX "PortalLoginAttempt_ip_createdAt_idx" ON "PortalLoginAttempt"("ip", "createdAt");

