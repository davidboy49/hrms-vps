-- AlterEnum
ALTER TYPE "DeviceMode" ADD VALUE 'QR';
-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "radiusM" INTEGER NOT NULL DEFAULT 150;
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employeeId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");
-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
