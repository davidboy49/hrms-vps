-- Bulk-created logins: force a password change at first sign-in, and let temporary passwords expire.
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "tempPasswordExpiresAt" TIMESTAMP(3);

-- HR can create logins in bulk by default (Admin always has every permission).
UPDATE "AppRole" SET "permissions" = array_append("permissions", 'users.createBatch')
WHERE "key" = 'HR' AND NOT ('users.createBatch' = ANY("permissions"));
