-- Roles with editable permissions replace the fixed Role enum.
CREATE TABLE "AppRole" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppRole_key_key" ON "AppRole"("key");
CREATE UNIQUE INDEX "AppRole_name_key" ON "AppRole"("name");

-- The four built-in roles keep the access the old fixed roles had.
INSERT INTO "AppRole" ("id","key","name","description","permissions","isSystem") VALUES
 ('role_admin','ADMIN','Admin','Full access',ARRAY['dashboard.view','alerts.view','employees.view','employees.edit','employees.import','employees.export','attendance.view','attendance.manage','attendance.export','attendance.devices','roster.view','roster.edit','qr.manage','leave.viewAll','leave.manage','overtime.viewAll','overtime.manage','announcements.manage','masterdata.view','masterdata.edit','masterdata.delete','settings.view','settings.manage','settings.notifications','users.manage','roles.manage','audit.view']::TEXT[],true),
 ('role_hr','HR','HR','Manages employees, attendance, leave and settings',ARRAY['dashboard.view','alerts.view','employees.view','attendance.view','roster.view','leave.viewAll','overtime.viewAll','employees.edit','employees.import','employees.export','attendance.manage','attendance.export','roster.edit','qr.manage','leave.manage','overtime.manage','announcements.manage','masterdata.view','masterdata.edit','settings.view']::TEXT[],true),
 ('role_manager','MANAGER','Manager','Views employees, attendance, leave and overtime',ARRAY['dashboard.view','alerts.view','employees.view','attendance.view','roster.view','leave.viewAll','overtime.viewAll']::TEXT[],true),
 ('role_employee','EMPLOYEE','Employee','Own attendance, leave and overtime only',ARRAY[]::TEXT[],true);

ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
UPDATE "User" SET "roleId" = CASE "role"::TEXT
  WHEN 'ADMIN' THEN 'role_admin' WHEN 'HR' THEN 'role_hr' WHEN 'MANAGER' THEN 'role_manager' ELSE 'role_employee' END;
ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AppRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role";
