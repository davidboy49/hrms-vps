-- Sign-in by username. Email becomes optional (most staff have none).
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Existing users get the part of their email before the @, made safe and unique.
WITH base AS (
  SELECT id,
         COALESCE(NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'user') AS b,
         "createdAt"
  FROM "User"
), ranked AS (
  SELECT id, b, row_number() OVER (PARTITION BY b ORDER BY "createdAt", id) AS n FROM base
)
UPDATE "User" u
SET "username" = CASE WHEN r.n = 1 THEN r.b ELSE r.b || r.n::text END
FROM ranked r WHERE u.id = r.id;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
