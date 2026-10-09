-- Leave: half-days, and quota rules per leave type (pro-rating for new joiners, a waiting period before the leave can start).
-- CreateEnum
CREATE TYPE "LeaveHalf" AS ENUM ('AM', 'PM');

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "firstHalf" "LeaveHalf",
ADD COLUMN     "lastHalf" "LeaveHalf";

-- AlterTable
ALTER TABLE "LeaveType" ADD COLUMN     "allowHalfDay" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "proRateNewJoiners" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waitingMonths" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RosterEntry" ADD COLUMN     "half" "LeaveHalf";


-- Starting values for the built-in types (editable in Leave > Leave types): Annual leave is pro-rated for new joiners and
-- cannot be taken in the first 3 months; sick and special leave are available from the first day.
UPDATE "LeaveType" SET "proRateNewJoiners" = true, "waitingMonths" = 3 WHERE "code" = 'ANNUAL';
