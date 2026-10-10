-- Payroll edition, phase 2A: allowance and deduction types and per-person assignments. Unused (empty) in the standard edition.
-- CreateEnum
CREATE TYPE "PayComponentKind" AS ENUM ('ALLOWANCE', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayComponentCalc" AS ENUM ('FIXED', 'PERCENT_OF_BASE');

-- CreateTable
CREATE TABLE "PayComponent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKm" TEXT,
    "kind" "PayComponentKind" NOT NULL,
    "calc" "PayComponentCalc" NOT NULL DEFAULT 'FIXED',
    "defaultAmount" DECIMAL(12,2),
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "nssfBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeComponent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayComponent_code_key" ON "PayComponent"("code");

-- CreateIndex
CREATE INDEX "EmployeeComponent_employeeId_idx" ON "EmployeeComponent"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeComponent_componentId_idx" ON "EmployeeComponent"("componentId");

-- AddForeignKey
ALTER TABLE "EmployeeComponent" ADD CONSTRAINT "EmployeeComponent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeComponent" ADD CONSTRAINT "EmployeeComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
