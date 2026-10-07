-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "leavingDate" DATE;

-- Employees already marked as left (status that does not count as active) get a leaving date from their last update
UPDATE "Employee" e
SET "leavingDate" = e."updatedAt"::date
FROM "EmployeeStatus" s
WHERE e."statusId" = s."id" AND s."countsAsActive" = false AND e."leavingDate" IS NULL;
