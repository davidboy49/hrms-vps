-- CreateTable
CREATE TABLE "BranchTransfer" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fromName" TEXT,
    "toName" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchTransfer_employeeId_idx" ON "BranchTransfer"("employeeId");

-- AddForeignKey
ALTER TABLE "BranchTransfer" ADD CONSTRAINT "BranchTransfer_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
