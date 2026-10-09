-- Employees are never deleted: they are deactivated and reactivated with a recorded reason.
CREATE TYPE "EmploymentEventKind" AS ENUM ('DEACTIVATED', 'REACTIVATED');

CREATE TABLE "EmploymentEvent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "EmploymentEventKind" NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "byUserId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmploymentEvent_employeeId_createdAt_idx" ON "EmploymentEvent"("employeeId", "createdAt");

ALTER TABLE "EmploymentEvent" ADD CONSTRAINT "EmploymentEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- HR can deactivate by default. Reactivating is Admin only until an Admin grants it to a role.
UPDATE "AppRole" SET "permissions" = array_append("permissions", 'employees.deactivate')
WHERE "key" = 'HR' AND NOT ('employees.deactivate' = ANY("permissions"));
