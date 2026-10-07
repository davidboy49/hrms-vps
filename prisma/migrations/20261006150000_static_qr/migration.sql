-- CreateEnum
CREATE TYPE "QrMode" AS ENUM ('ROTATING', 'STATIC');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "qrMode" "QrMode" NOT NULL DEFAULT 'STATIC',
ADD COLUMN     "qrVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AttendancePunch" ADD COLUMN     "accuracyM" INTEGER,
ADD COLUMN     "distanceM" INTEGER,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;
