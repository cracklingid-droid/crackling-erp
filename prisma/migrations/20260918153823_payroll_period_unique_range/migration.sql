-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_category_startDate_endDate_key" ON "PayrollPeriod"("category", "startDate", "endDate");

