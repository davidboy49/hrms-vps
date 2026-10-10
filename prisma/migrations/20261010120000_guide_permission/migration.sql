-- Reading the user guide is now a permission. Everyone could read it before, so every existing role keeps it.
UPDATE "AppRole" SET "permissions" = array_append("permissions", 'guide.view')
WHERE NOT ('guide.view' = ANY("permissions"));
