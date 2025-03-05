-- CreateTable
CREATE TABLE "BusyPeriod" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusyPeriod_startDate_endDate_idx" ON "BusyPeriod"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "BusyPeriod_year_idx" ON "BusyPeriod"("year");
