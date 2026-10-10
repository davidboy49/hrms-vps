-- Requesting your own leave / overtime is now a permission, so a company can switch it off per role.
-- Everyone could request before, so every existing role gets both: behaviour does not change until an Admin removes them.
UPDATE "AppRole" SET "permissions" = array_append("permissions", 'leave.request')
WHERE NOT ('leave.request' = ANY("permissions"));
UPDATE "AppRole" SET "permissions" = array_append("permissions", 'overtime.request')
WHERE NOT ('overtime.request' = ANY("permissions"));
