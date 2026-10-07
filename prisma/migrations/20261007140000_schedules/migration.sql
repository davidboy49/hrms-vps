-- CreateEnum
CREATE TYPE "DayKind" AS ENUM ('WORK', 'OFF');
-- CreateEnum
CREATE TYPE "RosterKind" AS ENUM ('WORK', 'OFF', 'LEAVE');
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "scheduleTemplateId" TEXT;
-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "colour" TEXT NOT NULL DEFAULT 'blue';
-- CreateTable
CREATE TABLE "ScheduleTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPersonal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "ScheduleTemplateDay" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "kind" "DayKind" NOT NULL DEFAULT 'WORK',
    "shiftId" TEXT,
    CONSTRAINT "ScheduleTemplateDay_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "RosterKind" NOT NULL,
    "shiftId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "ScheduleTemplateDay_templateId_weekday_key" ON "ScheduleTemplateDay"("templateId", "weekday");
-- CreateIndex
CREATE INDEX "RosterEntry_date_idx" ON "RosterEntry"("date");
-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_employeeId_date_key" ON "RosterEntry"("employeeId", "date");
-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_scheduleTemplateId_fkey" FOREIGN KEY ("scheduleTemplateId") REFERENCES "ScheduleTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ScheduleTemplateDay" ADD CONSTRAINT "ScheduleTemplateDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScheduleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "ScheduleTemplateDay" ADD CONSTRAINT "ScheduleTemplateDay_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
