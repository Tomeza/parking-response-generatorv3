-- CreateTable
CREATE TABLE "LargeVehicleSeason" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LargeVehicleSeason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LargeVehicleSeason_startDate_endDate_idx" ON "LargeVehicleSeason"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "LargeVehicleSeason_year_idx" ON "LargeVehicleSeason"("year"); 