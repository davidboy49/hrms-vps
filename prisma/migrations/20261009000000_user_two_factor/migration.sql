-- Two-factor sign-in (authenticator app), switched on per person by an Admin.
ALTER TABLE "User" ADD COLUMN "totpRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "totpLastStep" INTEGER;
ALTER TABLE "User" ADD COLUMN "recoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
