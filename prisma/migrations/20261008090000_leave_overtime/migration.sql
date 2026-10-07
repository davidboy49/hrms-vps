-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
-- AlterTable
ALTER TABLE "RosterEntry" ADD COLUMN     "leaveRequestId" TEXT;
-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "daysPerYear" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LeaveEntitlement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "LeaveEntitlement_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "OvertimeType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OvertimeType_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "overtimeTypeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");
-- CreateIndex
CREATE UNIQUE INDEX "LeaveEntitlement_employeeId_leaveTypeId_year_key" ON "LeaveEntitlement"("employeeId", "leaveTypeId", "year");
-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");
-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
-- CreateIndex
CREATE INDEX "LeaveRequest_fromDate_idx" ON "LeaveRequest"("fromDate");
-- CreateIndex
CREATE UNIQUE INDEX "OvertimeType_code_key" ON "OvertimeType"("code");
-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_idx" ON "OvertimeRequest"("employeeId");
-- CreateIndex
CREATE INDEX "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");
-- CreateIndex
CREATE INDEX "OvertimeRequest_date_idx" ON "OvertimeRequest"("date");
-- CreateIndex
CREATE INDEX "RosterEntry_leaveRequestId_idx" ON "RosterEntry"("leaveRequestId");
-- AddForeignKey
ALTER TABLE "LeaveEntitlement" ADD CONSTRAINT "LeaveEntitlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "LeaveEntitlement" ADD CONSTRAINT "LeaveEntitlement_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_overtimeTypeId_fkey" FOREIGN KEY ("overtimeTypeId") REFERENCES "OvertimeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Starting types, which HR can rename or change
INSERT INTO "LeaveType" ("id","code","name","isPaid","daysPerYear") VALUES
  ('lt_annual','ANNUAL','Annual leave',true,18),
  ('lt_sick','SICK','Sick leave',true,6),
  ('lt_special','SPECIAL','Special leave',true,7),
  ('lt_unpaid','UNPAID','Unpaid leave',false,NULL);
INSERT INTO "OvertimeType" ("id","code","name","multiplier") VALUES
  ('ot_normal','NORMAL','Normal day',1.5),
  ('ot_dayoff','DAYOFF','Day off',2),
  ('ot_holiday','HOLIDAY','Public holiday',3);
